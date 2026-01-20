import React, { useState, useCallback } from "react";

/**
 * Valid form field value types
 */
export type FormFieldValue = string | number | boolean | null | undefined;

/**
 * Validator function type
 */
export type ValidatorFn = (value: FormFieldValue, fieldName?: string) => string | null;

/**
 * Higher-order validator function type (returns a validator)
 */
export type ValidatorFactory<T = number> = (param: T) => ValidatorFn;

/**
 * Validation schema type
 */
export type ValidationSchema = Record<string, ValidatorFn[]>;

/**
 * Form values type
 */
export type FormValues = Record<string, string | number | boolean>;

/**
 * Form errors type
 */
export type FormErrors = Record<string, string | null>;

/**
 * Form touched state type
 */
export type FormTouched = Record<string, boolean>;

/**
 * Validation result type
 */
export interface ValidationResult {
  errors: FormErrors;
  isValid: boolean;
}

/**
 * Form validation hook return type
 */
export interface UseFormValidationResult<T extends FormValues> {
  values: T;
  errors: FormErrors;
  touched: FormTouched;
  handleChange: (name: keyof T, value: T[keyof T]) => void;
  handleBlur: (name: keyof T) => void;
  handleSubmit: (onSubmit: (values: T) => void) => (e?: React.SyntheticEvent) => void;
  reset: () => void;
  setValues: React.Dispatch<React.SetStateAction<T>>;
}

/**
 * Production-grade validation utility
 * Inspired by Zod/Yup patterns for type-safe validation
 */
export const validators = {
  required: (value: FormFieldValue, fieldName: string = "This field"): string | null => {
    if (value === null || value === undefined || value === false || (typeof value === "string" && !value.trim())) {
      return `${fieldName} is required`;
    }
    return null;
  },

  email: (value: FormFieldValue): string | null => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(value))) {
      return "Invalid email address";
    }
    return null;
  },

  minLength: (min: number): ValidatorFn =>
    (value: FormFieldValue, fieldName: string = "This field"): string | null => {
      if (!value) return null;
      if (String(value).length < min) {
        return `${fieldName} must be at least ${min} characters`;
      }
      return null;
    },

  maxLength: (max: number): ValidatorFn =>
    (value: FormFieldValue, fieldName: string = "This field"): string | null => {
      if (!value) return null;
      if (String(value).length > max) {
        return `${fieldName} must be at most ${max} characters`;
      }
      return null;
    },

  min: (minValue: number): ValidatorFn =>
    (value: FormFieldValue, fieldName: string = "This field"): string | null => {
      if (value === null || value === undefined || value === "") return null;
      if (Number(value) < minValue) {
        return `${fieldName} must be at least ${minValue}`;
      }
      return null;
    },

  max: (maxValue: number): ValidatorFn =>
    (value: FormFieldValue, fieldName: string = "This field"): string | null => {
      if (value === null || value === undefined || value === "") return null;
      if (Number(value) > maxValue) {
        return `${fieldName} must be at most ${maxValue}`;
      }
      return null;
    },

  phoneNumber: (value: FormFieldValue): string | null => {
    if (!value) return null;
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(String(value).replace(/\s/g, ""))) {
      return "Invalid phone number format";
    }
    return null;
  },

  numeric: (value: FormFieldValue, fieldName: string = "This field"): string | null => {
    if (!value) return null;
    if (isNaN(Number(value))) {
      return `${fieldName} must be a number`;
    }
    return null;
  },

  pattern: (regex: RegExp, message?: string): ValidatorFn =>
    (value: FormFieldValue): string | null => {
      if (!value) return null;
      if (!regex.test(String(value))) {
        return message || "Invalid format";
      }
      return null;
    },

  oneOf: (options: string[]): ValidatorFn =>
    (value: FormFieldValue, fieldName: string = "This field"): string | null => {
      if (!value) return null;
      if (!options.includes(String(value))) {
        return `${fieldName} must be one of: ${options.join(", ")}`;
      }
      return null;
    },

  /**
   * Validator for boolean fields like checkboxes
   */
  checked: (message?: string): ValidatorFn =>
    (value: FormFieldValue): string | null => {
      if (value !== true) {
        return message || "This field must be checked";
      }
      return null;
    },
};

/**
 * Validation schema builder
 * 
 * @example
 * ```ts
 * const schema = createSchema({
 *   email: [validators.required, validators.email],
 *   password: [validators.required, validators.minLength(8)]
 * });
 * ```
 */
export function createSchema<T extends ValidationSchema>(fields: T): T {
  return fields;
}

/**
 * Validate a single field against validation rules
 */
export function validateField(
  value: FormFieldValue,
  rules: ValidatorFn[] | undefined,
  fieldName?: string
): string | null {
  if (!rules) return null;

  for (const rule of rules) {
    const error = rule(value, fieldName);
    if (error) return error;
  }

  return null;
}

/**
 * Validate entire form against a schema
 * 
 * @returns Object containing errors and isValid flag
 */
export function validateForm<T extends FormValues>(
  values: T,
  schema: ValidationSchema
): ValidationResult {
  const errors: FormErrors = {};
  let isValid = true;

  Object.keys(schema).forEach((fieldName) => {
    const rules = schema[fieldName];
    const value = values[fieldName] as FormFieldValue;
    const error = validateField(value, rules, fieldName);

    if (error) {
      errors[fieldName] = error;
      isValid = false;
    }
  });

  return { errors, isValid };
}

/**
 * Custom hook for form validation with React state management
 * 
 * @param initialValues - Initial form values
 * @param validationSchema - Validation rules for each field
 * 
 * @example
 * ```tsx
 * const form = useFormValidation(
 *   { email: '', password: '' },
 *   { email: [validators.required, validators.email], password: [validators.required] }
 * );
 * 
 * return (
 *   <FormInput
 *     value={form.values.email}
 *     onChangeText={(v) => form.handleChange('email', v)}
 *     error={form.errors.email}
 *     touched={form.touched.email}
 *   />
 * );
 * ```
 */
export function useFormValidation<T extends FormValues>(
  initialValues: T,
  validationSchema: ValidationSchema
): UseFormValidationResult<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});

  const handleChange = useCallback(
    (name: keyof T, value: T[keyof T]): void => {
      setValues((prev) => ({ ...prev, [name]: value }));

      // Clear error when user starts typing
      setErrors((prev) => {
        if (prev[name as string]) {
          return { ...prev, [name]: null };
        }
        return prev;
      });
    },
    []
  );

  const handleBlur = useCallback(
    (name: keyof T): void => {
      setTouched((prev) => ({ ...prev, [name]: true }));

      // Validate on blur
      if (validationSchema[name as string]) {
        const error = validateField(
          values[name] as string | number | null | undefined,
          validationSchema[name as string],
          name as string
        );
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [validationSchema, values]
  );

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => void) =>
      (e?: React.SyntheticEvent): void => {
        if (e && e.preventDefault) e.preventDefault();

        // Mark all fields as touched
        const allTouched: FormTouched = {};
        Object.keys(validationSchema).forEach((key) => {
          allTouched[key] = true;
        });
        setTouched(allTouched);

        // Validate all fields
        const { errors: validationErrors, isValid } = validateForm(values, validationSchema);
        setErrors(validationErrors);

        if (isValid) {
          onSubmit(values);
        }
      },
    [validationSchema, values]
  );

  const reset = useCallback((): void => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setValues,
  };
}

export default validators;
