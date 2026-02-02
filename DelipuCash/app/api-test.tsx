/**
 * API Test Screen
 * 
 * @description A development screen to test API connectivity and authentication.
 * Remove this screen before production deployment.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/utils/theme";
import { router } from "expo-router";
import { ArrowLeft, CheckCircle, XCircle, RefreshCw } from "lucide-react-native";
import { runAllTests, testLogin, testSignup } from "@/services/apiConnectionTest";

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration?: number;
}

export default function ApiTestScreen() {
  const { colors, statusBarStyle } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [customEmail, setCustomEmail] = useState("");
  const [customPassword, setCustomPassword] = useState("");

  const handleRunAllTests = useCallback(async () => {
    setIsLoading(true);
    setResults([]);
    try {
      const testSuite = await runAllTests();
      setResults(testSuite.results);
    } catch (error) {
      Alert.alert("Test Error", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCustomLogin = useCallback(async () => {
    if (!customEmail || !customPassword) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    setIsLoading(true);
    try {
      const result = await testLogin(customEmail, customPassword);
      setResults((prev) => [...prev, result]);
      if (result.success) {
        Alert.alert("Success", "Login successful!");
      } else {
        Alert.alert("Login Failed", result.message || result.error || "Unknown error");
      }
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [customEmail, customPassword]);

  const handleCustomSignup = useCallback(async () => {
    if (!customEmail || !customPassword) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    setIsLoading(true);
    try {
      const result = await testSignup(customEmail, customPassword, "Test", "User");
      setResults((prev) => [...prev, result]);
      if (result.success) {
        Alert.alert("Success", "Signup successful! You can now login.");
      } else {
        Alert.alert("Signup Failed", result.message || result.error || "Unknown error");
      }
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [customEmail, customPassword]);

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>API Connection Test</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Server Info */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Server Configuration</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            API URL: {process.env.EXPO_PUBLIC_API_URL || "Not configured"}
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Mode: {process.env.EXPO_PUBLIC_API_URL ? "Real API" : "Mock Data"}
          </Text>
        </View>

        {/* Run All Tests Button */}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleRunAllTests}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <RefreshCw size={20} color="#fff" />
              <Text style={styles.buttonText}>Run All Tests</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Custom Login Test */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Custom Login Test</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={customEmail}
            onChangeText={setCustomEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={customPassword}
            onChangeText={setCustomPassword}
            secureTextEntry
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: colors.primary }]}
              onPress={handleCustomLogin}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Test Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: colors.success || "#22c55e" }]}
              onPress={handleCustomSignup}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Test Signup</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Test Results */}
        {results.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Test Results</Text>
            {results.map((result, index) => (
              <View key={index} style={[styles.resultItem, { borderBottomColor: colors.border }]}>
                <View style={styles.resultHeader}>
                  {result.success ? (
                    <CheckCircle size={20} color={colors.success || "#22c55e"} />
                  ) : (
                    <XCircle size={20} color={colors.error} />
                  )}
                  <Text style={[styles.resultName, { color: colors.text }]}>{result.name}</Text>
                  {result.duration && (
                    <Text style={[styles.duration, { color: colors.textSecondary }]}>
                      {result.duration}ms
                    </Text>
                  )}
                </View>
                <Text style={[styles.resultMessage, { color: colors.textSecondary }]}>
                  {result.message}
                </Text>
                {result.error && (
                  <Text style={[styles.errorText, { color: colors.error }]}>
                    Error: {result.error}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Instructions */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Setup Instructions</Text>
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            1. Start the server:{"\n"}
            <Text style={{ fontFamily: "monospace" }}>cd server && bun run dev</Text>
          </Text>
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            2. Update .env in DelipuCash folder:{"\n"}
            <Text style={{ fontFamily: "monospace" }}>EXPO_PUBLIC_API_URL=http://localhost:3000</Text>
          </Text>
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            3. For physical devices, use your computer&apos;s IP:{"\n"}
            <Text style={{ fontFamily: "monospace" }}>EXPO_PUBLIC_API_URL=http://192.168.x.x:3000</Text>
          </Text>
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            4. Restart the Expo development server after changing .env
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      padding: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      gap: 16,
    },
    card: {
      borderRadius: 12,
      padding: 16,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 12,
    },
    infoText: {
      fontSize: 14,
      marginBottom: 4,
      fontFamily: "monospace",
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 10,
    },
    secondaryButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 8,
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    buttonRow: {
      flexDirection: "row",
      gap: 12,
    },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      marginBottom: 12,
    },
    resultItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    resultName: {
      fontSize: 14,
      fontWeight: "500",
      flex: 1,
    },
    duration: {
      fontSize: 12,
    },
    resultMessage: {
      fontSize: 13,
      marginLeft: 28,
    },
    errorText: {
      fontSize: 12,
      marginLeft: 28,
      marginTop: 4,
    },
    instructionText: {
      fontSize: 13,
      marginBottom: 12,
      lineHeight: 20,
    },
  });
