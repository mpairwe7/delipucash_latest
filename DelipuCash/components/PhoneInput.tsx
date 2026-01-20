import React, { useState, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Animated,
  StyleSheet,
  type ViewStyle,
  type ListRenderItemInfo,
} from 'react-native';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { useTheme } from '@/utils/theme';

/**
 * Country data structure
 */
export interface CountryCode {
  /** Dial code (e.g., "+256") */
  code: string;
  /** Country name */
  country: string;
  /** Flag emoji */
  flag: string;
}

/**
 * Props for the PhoneInput component
 */
export interface PhoneInputProps {
  /** Label text displayed above the input */
  label?: string;
  /** Current phone value including country code */
  value?: string;
  /** Callback when phone number changes */
  onChangeText?: (text: string) => void;
  /** Callback when input loses focus */
  onBlur?: () => void;
  /** Error message to display */
  error?: string | null;
  /** Whether the field has been touched/visited */
  touched?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Container style */
  style?: ViewStyle;
  /** Default country code to select */
  defaultCountryCode?: string;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Common country codes for Africa and international
 */
export const COUNTRY_CODES: readonly CountryCode[] = [
  { code: '+256', country: 'Uganda', flag: '🇺🇬' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
  { code: '+243', country: 'DR Congo', flag: '🇨🇩' },
  { code: '+251', country: 'Ethiopia', flag: '🇪🇹' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+1', country: 'USA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
] as const;

/**
 * Phone input component with country code picker.
 * Includes searchable country list modal and proper formatting.
 *
 * @example
 * ```tsx
 * <PhoneInput
 *   label="Phone Number"
 *   value={phone}
 *   onChangeText={setPhone}
 *   error={errors.phone}
 *   touched={touched.phone}
 *   defaultCountryCode="+256"
 * />
 * ```
 */
export const PhoneInput = memo<PhoneInputProps>(({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  touched = false,
  placeholder = 'Phone number',
  style,
  defaultCountryCode = '+256',
  testID,
}) => {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    () => COUNTRY_CODES.find((c) => c.code === defaultCountryCode) || COUNTRY_CODES[0]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(() => {
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [focusAnim]);

  const handleBlur = useCallback(
    () => {
      Animated.timing(focusAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
      onBlur?.();
    },
    [focusAnim, onBlur]
  );

  const handleCountrySelect = useCallback(
    (country: CountryCode) => {
      setSelectedCountry(country);
      setShowPicker(false);
      setSearchQuery('');
      const phoneWithoutCode = value?.replace(/^\+\d+\s*/, '') || '';
      onChangeText?.(`${country.code} ${phoneWithoutCode}`);
    },
    [value, onChangeText]
  );

  const handlePhoneChange = useCallback(
    (text: string) => {
      const cleanNumber = text.replace(/^0+/, '');
      onChangeText?.(`${selectedCountry.code} ${cleanNumber}`);
    },
    [selectedCountry.code, onChangeText]
  );

  const openPicker = useCallback(() => setShowPicker(true), []);
  const closePicker = useCallback(() => {
    setShowPicker(false);
    setSearchQuery('');
  }, []);

  const filteredCountries = COUNTRY_CODES.filter(
    (c) =>
      c.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.includes(searchQuery)
  );

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error && touched ? colors.error : colors.border,
      error && touched ? colors.error : colors.primary,
    ],
  });

  const displayNumber = value?.replace(/^\+\d+\s*/, '') || '';
  const hasError = Boolean(error && touched);

  const renderCountryItem = useCallback(
    ({ item }: ListRenderItemInfo<CountryCode>) => (
      <TouchableOpacity
        onPress={() => handleCountrySelect(item)}
        style={[
          styles.countryItem,
          {
            backgroundColor:
              selectedCountry.code === item.code ? colors.elevated : 'transparent',
          },
        ]}
        accessibilityLabel={`${item.country} ${item.code}`}
        accessibilityRole="button"
      >
        <Text style={styles.countryFlag}>{item.flag}</Text>
        <Text style={[styles.countryName, { color: colors.text }]}>
          {item.country}
        </Text>
        <Text style={[styles.countryCode, { color: colors.textSecondary }]}>
          {item.code}
        </Text>
      </TouchableOpacity>
    ),
    [selectedCountry.code, colors, handleCountrySelect]
  );

  const keyExtractor = useCallback((item: CountryCode) => item.code, []);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      )}

      <Animated.View
        style={[
          styles.inputContainer,
          { backgroundColor: colors.card, borderColor },
        ]}
      >
        {/* Country Code Selector */}
        <TouchableOpacity
          onPress={openPicker}
          style={[
            styles.countrySelector,
            {
              borderRightColor: colors.border,
              backgroundColor: colors.elevated,
            },
          ]}
          accessibilityLabel={`Selected country: ${selectedCountry.country}`}
          accessibilityHint="Double tap to change country"
          accessibilityRole="button"
        >
          <Text style={styles.selectedFlag}>{selectedCountry.flag}</Text>
          <Text style={[styles.selectedCode, { color: colors.text }]}>
            {selectedCountry.code}
          </Text>
          <ChevronDown size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Phone Number Input */}
        <TextInput
          value={displayNumber}
          onChangeText={handlePhoneChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          style={[styles.phoneInput, { color: colors.text }]}
          accessibilityLabel={label || 'Phone number'}
        />
      </Animated.View>

      {hasError && (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      )}

      {/* Country Picker Modal */}
      <Modal
        visible={showPicker}
        animationType="slide"
        transparent
        onRequestClose={closePicker}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: colors.background }]}
          >
            {/* Header */}
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select Country
              </Text>
              <TouchableOpacity
                onPress={closePicker}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View
              style={[styles.searchContainer, { backgroundColor: colors.card }]}
            >
              <Search size={20} color={colors.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search country..."
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.text }]}
                autoFocus
              />
            </View>

            {/* Country List */}
            <FlatList
              data={filteredCountries}
              keyExtractor={keyExtractor}
              renderItem={renderCountryItem}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              getItemLayout={(_, index) => ({
                length: 52,
                offset: 52 * index,
                index,
              })}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
});

PhoneInput.displayName = 'PhoneInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRightWidth: 1,
  },
  selectedFlag: {
    fontSize: 20,
    marginRight: 4,
  },
  selectedCode: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
    marginRight: 4,
  },
  phoneInput: {
    flex: 1,
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    flex: 1,
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
  },
  countryCode: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
  },
});

export default PhoneInput;
