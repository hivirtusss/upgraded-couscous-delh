import { StatusBar } from 'expo-status-bar';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HELPLINES, PROFILE } from './constants/profile';
import TxtFirebasePanel from './components/TxtFirebasePanel';

function Card({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function HelplineButton({ label, number }) {
  return (
    <Pressable
      style={styles.helplineBtn}
      onPress={() => Linking.openURL(`tel:${number}`)}
    >
      <Text style={styles.helplineLabel}>{label}</Text>
      <Text style={styles.helplineNumber}>{number}</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.badge}>Project 2 — APK</Text>
        <Text style={styles.name}>{PROFILE.name}</Text>
        <Text style={styles.tagline}>{PROFILE.tagline}</Text>

        <Card title="Mere baare mein">
          <Text style={styles.body}>{PROFILE.about}</Text>
        </Card>

        <Card title="Skills">
          {PROFILE.skills.map((skill) => (
            <Text key={skill} style={styles.listItem}>
              • {skill}
            </Text>
          ))}
        </Card>

        <Card title="Project">
          <Text style={styles.body}>
            Meri pehli Android app — portfolio + madad ke numbers save.
          </Text>
        </Card>

        <Card title="Txt file + Firebase">
          <TxtFirebasePanel />
        </Card>

        <Card title="Jab bahut bura lage (call)">
          <Text style={styles.muted}>
            Weak nahi — support. Tap karke dial ho jayega.
          </Text>
          {HELPLINES.map((h) => (
            <HelplineButton key={h.number} {...h} />
          ))}
        </Card>

        <Text style={styles.footer}>
          Kal: profile.js mein naam/skills update → dubara APK banao.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  scroll: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  badge: {
    alignSelf: 'flex-start',
    color: '#3dd6c3',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e7ecf3',
  },
  tagline: {
    fontSize: 16,
    color: '#9aa8b8',
    marginTop: 6,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1a2332',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#9aa8b8',
    marginBottom: 10,
  },
  body: {
    color: '#e7ecf3',
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: '#9aa8b8',
    fontSize: 14,
    marginBottom: 12,
  },
  listItem: {
    color: '#e7ecf3',
    fontSize: 15,
    marginBottom: 4,
  },
  helplineBtn: {
    backgroundColor: '#243044',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helplineLabel: {
    color: '#e7ecf3',
    fontWeight: '600',
  },
  helplineNumber: {
    color: '#3dd6c3',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: '#9aa8b8',
    fontSize: 13,
    marginTop: 8,
  },
});
