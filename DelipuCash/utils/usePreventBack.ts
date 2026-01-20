import { useFocusEffect } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { BackHandler } from "react-native";

/**
 * Custom hook to prevent the user from navigating back
 * 
 * @description This hook disables all forms of back navigation including:
 * - Header back button (sets to null)
 * - Gesture-based navigation (swipe back)
 * - Android hardware back button
 * 
 * Useful for screens that require user completion before leaving,
 * such as payment flows, onboarding, or form submissions.
 * 
 * @example
 * ```tsx
 * function PaymentScreen() {
 *   usePreventBack();
 *   
 *   return (
 *     <View>
 *       <Text>Complete your payment</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export const usePreventBack = (): void => {
  const navigation = useNavigation();

  useFocusEffect(() => {
    // Disable header back button and gesture navigation
    navigation.setOptions({
      headerLeft: () => null,
      gestureEnabled: false,
    });

    // Also disable gesture on parent navigator (for nested navigation)
    navigation.getParent()?.setOptions({ gestureEnabled: false });

    // Android hardware back button handler
    const hardwareBackPressHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      (): boolean => {
        // Return true to prevent default behavior of leaving the screen
        return true;
      }
    );

    // Cleanup: restore navigation options when screen loses focus
    return () => {
      navigation.getParent()?.setOptions({ gestureEnabled: true });
      navigation.setOptions({
        gestureEnabled: true,
      });
      hardwareBackPressHandler.remove();
    };
  });
};

export default usePreventBack;
