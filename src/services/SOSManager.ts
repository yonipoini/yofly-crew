import { Alert } from 'react-native';
import { EmergencyContact } from '../types/safety';
import { buildFallbackEmergencyContacts, normalizeEmergencyContacts } from '../utils/beaconSOS';

class SOSManagerService {
  private timer: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private isEmergencyCheckActive: boolean = false;
  private contactPhone: string = '';
  private contacts: EmergencyContact[] = [];

  setContact(phone: string) {
    this.setContacts(buildFallbackEmergencyContacts(phone));
  }

  setContacts(contacts: EmergencyContact[]) {
    this.contacts = normalizeEmergencyContacts(contacts);
    this.contactPhone = this.contacts[0]?.phone || '';
  }

  getContact() {
    return this.contactPhone;
  }

  getContacts() {
    return this.contacts;
  }

  isSOSActive() {
    return this.isActive;
  }

  startSOS() {
    if (!this.contactPhone) {
      Alert.alert("Missing Contact", "Please set an emergency contact first.");
      return;
    }
    
    this.isActive = true;
    this.stopEmergencyCheckTimer();
    Alert.alert("Beacon SOS Armed", "Safety checks will only start after you report an emergency or trigger SOS.");
  }

  stopSOS() {
    this.isActive = false;
    this.stopEmergencyCheckTimer();
  }

  startEmergencySafetyCheck() {
    if (!this.isActive) {
      return;
    }

    if (this.isEmergencyCheckActive) {
      return;
    }

    this.isEmergencyCheckActive = true;
    this.promptSafetyCheck();
    this.timer = setInterval(() => {
      this.promptSafetyCheck();
    }, 15 * 60 * 1000) as any;
  }

  private stopEmergencyCheckTimer() {
    this.isEmergencyCheckActive = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private promptSafetyCheck() {
    // We set a timeout for how long they have to answer
    let responded = false;
    
    const timeout = setTimeout(() => {
      if (!responded) {
        this.triggerEmergencyProtocol();
      }
    }, 10000); // 10 seconds to respond for demo
    
    Alert.alert(
      "Safety Check",
      "Are you OK?",
      [
        {
          text: "I'm OK",
          onPress: () => {
            responded = true;
            clearTimeout(timeout);
            console.log("User confirmed safety.");
          }
        },
        {
          text: "SEND HELP",
          style: 'destructive',
          onPress: () => {
             responded = true;
             clearTimeout(timeout);
             this.triggerEmergencyProtocol();
          }
        }
      ],
      { cancelable: false }
    );
  }

  private triggerEmergencyProtocol() {
    this.stopSOS();
    // In a real app, we would get real location from expo-location and hit an external API (Twilio)
    const mockLocation = "Lat: 40.6413, Long: -73.7781 (JFK Airport)";
    console.log(`[EMERGENCY SOS DISPATCHED] Sending SMS to ${this.contactPhone}... Location: ${mockLocation}`);
    const primaryContact = this.contacts[0];
    const notifiedCount = this.contacts.length || 1;
    
    Alert.alert(
      "EMERGENCY PROTOCOL ACTIVATED", 
      primaryContact
        ? `${notifiedCount} Beacon emergency contact${notifiedCount === 1 ? '' : 's'} notified. Primary: ${primaryContact.name} (${primaryContact.phone}).`
        : `Your emergency contact (${this.contactPhone}) has been notified of your last known location.`
    );
  }
}

export const SOSManager = new SOSManagerService();
