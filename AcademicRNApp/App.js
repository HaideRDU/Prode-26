import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import StandardCalculator from './components/StandardCalculator';
import GradeCalculator from './components/GradeCalculator';

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Calculadora académica</Text>
          <Text style={styles.subtitle}>
            Herramientas simples para clase
          </Text>
        </View>
        <StandardCalculator />
        <GradeCalculator />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: '#555',
  },
});
