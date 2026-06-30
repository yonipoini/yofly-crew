import { EmergencyContact } from '../types/safety';

export const MAX_BEACON_CONTACTS = 5;

const normalizeText = (value?: string) => (value || '').trim();

export const buildFallbackEmergencyContacts = (phone?: string): EmergencyContact[] => {
  const normalizedPhone = normalizeText(phone);

  if (!normalizedPhone) {
    return [];
  }

  return [
    {
      id: 'primary-contact',
      name: 'Primary Contact',
      phone: normalizedPhone,
      relation: 'Emergency',
    },
  ];
};

export const normalizeEmergencyContacts = (
  contacts?: EmergencyContact[],
  fallbackPhone?: string
): EmergencyContact[] => {
  const source = contacts && contacts.length > 0 ? contacts : buildFallbackEmergencyContacts(fallbackPhone);

  return source
    .map((contact, index) => {
      const phone = normalizeText(contact.phone);

      if (!phone) {
        return null;
      }

      const relation = normalizeText(contact.relation);
      const name = normalizeText(contact.name) || relation || `Emergency Contact ${index + 1}`;

      return {
        id: normalizeText(contact.id) || `beacon-contact-${index + 1}`,
        name,
        phone,
        relation,
      };
    })
    .filter((contact): contact is EmergencyContact => Boolean(contact))
    .slice(0, MAX_BEACON_CONTACTS);
};

export const getPrimaryEmergencyPhone = (contacts?: EmergencyContact[], fallbackPhone?: string) =>
  normalizeEmergencyContacts(contacts, fallbackPhone)[0]?.phone || '';

export const getEmergencyContactCountLabel = (contacts?: EmergencyContact[], fallbackPhone?: string) => {
  const count = normalizeEmergencyContacts(contacts, fallbackPhone).length;

  if (!count) {
    return 'No emergency contacts added';
  }

  return `${count} emergency contact${count === 1 ? '' : 's'} ready`;
};
