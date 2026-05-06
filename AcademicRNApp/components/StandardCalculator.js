import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';

const BUTTONS = [
  ['C', '⌫', '/', '*'],
  ['7', '8', '9', '-'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '='],
  ['0', '.', '', ''],
];

export default function StandardCalculator() {
  const [display, setDisplay] = useState('0');
  const [previous, setPrevious] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [history, setHistory] = useState([]);

  const inputDigit = (digit) => {
    if (waitingForOperand) {
      setDisplay(String(digit));
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? String(digit) : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const clearAll = () => {
    setDisplay('0');
    setPrevious(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const backspace = () => {
    if (waitingForOperand) return;
    if (display.length <= 1) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const performOperation = (nextOperator) => {
    const inputValue = parseFloat(display);

    if (previous == null) {
      setPrevious(inputValue);
    } else if (operator) {
      const currentValue = previous || 0;
      const newValue = calculate(currentValue, inputValue, operator);

      const expr = `${formatNum(currentValue)} ${operator} ${formatNum(inputValue)} = ${formatNum(newValue)}`;
      setHistory((h) => [expr, ...h].slice(0, 20));

      setDisplay(String(newValue));
      setPrevious(newValue);
    } else {
      setPrevious(inputValue);
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);
    if (previous == null || operator == null) return;

    const newValue = calculate(previous, inputValue, operator);
    const expr = `${formatNum(previous)} ${operator} ${formatNum(inputValue)} = ${formatNum(newValue)}`;
    setHistory((h) => [expr, ...h].slice(0, 20));

    setDisplay(String(newValue));
    setPrevious(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  const handlePress = (label) => {
    if (label === '' || label == null) return;
    if (label >= '0' && label <= '9') {
      inputDigit(label);
      return;
    }
    if (label === '.') {
      inputDot();
      return;
    }
    if (label === 'C') {
      clearAll();
      return;
    }
    if (label === '⌫') {
      backspace();
      return;
    }
    if (label === '=') {
      handleEquals();
      return;
    }
    if (['+', '-', '*', '/'].includes(label)) {
      performOperation(label);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Calculadora normal</Text>
      <View style={styles.displayWrap}>
        <Text style={styles.display} numberOfLines={1}>
          {display}
        </Text>
      </View>
      {BUTTONS.map((row, rowIndex) => (
        <View key={String(rowIndex)} style={styles.row}>
          {row.map((cell, colIndex) => (
            <TouchableOpacity
              key={`${rowIndex}-${colIndex}`}
              style={[styles.btn, cell === '' && styles.btnHidden]}
              onPress={() => handlePress(cell)}
              disabled={cell === ''}
            >
              <Text style={styles.btnText}>{cell}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <Text style={styles.historyTitle}>Historial</Text>
      <FlatList
        data={history}
        keyExtractor={(item, index) => `${index}-${item}`}
        style={styles.historyList}
        ListEmptyComponent={
          <Text style={styles.historyEmpty}>Sin cálculos aún</Text>
        }
        renderItem={({ item }) => (
          <Text style={styles.historyItem}>{item}</Text>
        )}
      />
    </View>
  );
}

function calculate(prev, next, op) {
  switch (op) {
    case '+':
      return prev + next;
    case '-':
      return prev - next;
    case '*':
      return prev * next;
    case '/':
      return next === 0 ? 0 : prev / next;
    default:
      return next;
  }
}

function formatNum(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(8)));
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#222',
  },
  displayWrap: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  display: {
    fontSize: 28,
    textAlign: 'right',
    color: '#111',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  btn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 14,
    backgroundColor: '#e8e8e8',
    borderRadius: 8,
    alignItems: 'center',
  },
  btnHidden: {
    opacity: 0,
  },
  btnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  historyTitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
  },
  historyList: {
    maxHeight: 140,
    marginTop: 8,
  },
  historyEmpty: {
    color: '#888',
    fontStyle: 'italic',
  },
  historyItem: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    color: '#333',
  },
});
