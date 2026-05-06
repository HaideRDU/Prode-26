import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export default function GradeCalculator() {
  const [grades, setGrades] = useState(['']);
  const [average, setAverage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChangeText = (index, text) => {
    const next = [...grades];
    next[index] = text;
    setGrades(next);
    setErrorMessage('');
    setAverage(null);
  };

  const addGradeField = () => {
    setGrades([...grades, '']);
    setErrorMessage('');
    setAverage(null);
  };

  const removeLastField = () => {
    if (grades.length <= 1) return;
    const next = grades.slice(0, -1);
    setGrades(next);
    setErrorMessage('');
    setAverage(null);
  };

  const computeAverage = () => {
    const trimmed = grades.map((g) => g.trim()).filter((g) => g !== '');

    if (trimmed.length === 0) {
      setErrorMessage('Ingresa al menos una nota.');
      setAverage(null);
      return;
    }

    const numbers = [];
    for (let i = 0; i < trimmed.length; i += 1) {
      const n = parseFloat(trimmed[i].replace(',', '.'));
      if (Number.isNaN(n)) {
        setErrorMessage(`La nota "${trimmed[i]}" no es un número válido.`);
        setAverage(null);
        return;
      }
      if (n < 0 || n > 10) {
        setErrorMessage('Las notas deben estar entre 0 y 10.');
        setAverage(null);
        return;
      }
      numbers.push(n);
    }

    const sum = numbers.reduce((acc, v) => acc + v, 0);
    const avg = sum / numbers.length;
    setAverage(avg);
    setErrorMessage('');
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Calculadora de notas</Text>
      <Text style={styles.hint}>
        Escribe cada nota (0 a 10). Puedes usar coma o punto decimal.
      </Text>
      {grades.map((value, index) => (
        <TextInput
          key={String(index)}
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder={`Nota ${index + 1}`}
          value={value}
          onChangeText={(text) => handleChangeText(index, text)}
        />
      ))}
      <View style={styles.rowButtons}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={addGradeField}>
          <Text style={styles.secondaryBtnText}>+ Nota</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={removeLastField}>
          <Text style={styles.secondaryBtnText}>- Campo</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={computeAverage}>
        <Text style={styles.primaryBtnText}>Calcular promedio</Text>
      </TouchableOpacity>
      {errorMessage ? (
        <Text style={styles.error}>{errorMessage}</Text>
      ) : null}
      {average != null ? (
        <Text style={styles.result}>
          Promedio: {average.toFixed(2)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#222',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  rowButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  secondaryBtn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    backgroundColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontWeight: '600',
    color: '#333',
  },
  primaryBtn: {
    backgroundColor: '#2a6f97',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    marginTop: 12,
    color: '#b00020',
    fontSize: 14,
  },
  result: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#1b5e20',
  },
});
