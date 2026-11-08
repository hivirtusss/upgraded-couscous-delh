import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  PIN_MODES,
  SMS_AGE_FILTERS,
  SORT_ORDERS,
} from '../lib/deviceFilters';

function ChipRow({ title, options, value, onChange }) {
  return (
    <View style={styles.block}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            style={[styles.chip, value === o.key && styles.chipOn]}
            onPress={() => onChange(o.key)}
          >
            <Text style={[styles.chipText, value === o.key && styles.chipTextOn]}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function DeviceFilterToolbar({
  sortOrder,
  onSortOrder,
  pinMode,
  onPinMode,
  smsAgeKey,
  onSmsAgeKey,
  shownCount,
  totalCount,
}) {
  return (
    <View>
      <Text style={styles.summary}>
        Dikh rahe {shownCount} / {totalCount}
      </Text>
      <ChipRow
        title="Sort"
        options={SORT_ORDERS}
        value={sortOrder}
        onChange={onSortOrder}
      />
      <ChipRow
        title="PIN"
        options={PIN_MODES}
        value={pinMode}
        onChange={onPinMode}
      />
      <ChipRow
        title="SMS (last)"
        options={SMS_AGE_FILTERS}
        value={smsAgeKey}
        onChange={onSmsAgeKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    color: '#6b8cff',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
  },
  block: { marginBottom: 10 },
  title: {
    color: '#9aa8b8',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3a4555',
  },
  chipOn: {
    borderColor: '#3dd6c3',
    backgroundColor: 'rgba(61, 214, 195, 0.12)',
  },
  chipText: { color: '#9aa8b8', fontSize: 11 },
  chipTextOn: { color: '#3dd6c3', fontWeight: '600' },
});
