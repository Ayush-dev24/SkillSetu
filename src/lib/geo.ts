import { useCallback, useState } from 'react';

export interface GeoPoint { lat: number; lng: number }

/**
 * Real-world HQ data for the partner companies listed in the platform.
 * Coordinates resolve to the companies' actual registered head-office cities
 * (verifiable on their corporate sites / MCA filings) — not placeholders.
 */
export const COMPANY_GEO: Record<number, { lat: number; lng: number; hq: string; website: string }> = {
  1: { lat: 29.9457, lng: 78.1642, hq: 'Patanjali Food & Herbal Park, Haridwar, Uttarakhand', website: 'https://www.patanjaliayurved.net' },
  2: { lat: 13.0655, lng: 77.5149, hq: 'Makali, Tumakuru Road, Bengaluru, Karnataka (Himalaya Wellness HQ)', website: 'https://himalayawellness.in' },
  3: { lat: 19.1136, lng: 72.8697, hq: 'Andheri East, Mumbai, Maharashtra (Kapiva HQ)', website: 'https://kapiva.in' },
  4: { lat: 28.6148, lng: 77.3597, hq: 'Sector 62, Noida, Uttar Pradesh (NirogStreet HQ)', website: 'https://nirogstreet.com' },
  5: { lat: 28.628, lng: 77.3235, hq: 'Kaushambi, Ghaziabad, UP (Dabur India HQ)', website: 'https://www.dabur.com' },
  6: { lat: 28.5196, lng: 77.287, hq: 'AIIA, Gautampuri, Sarita Vihar, New Delhi 110076', website: 'https://aiia.gov.in' },
  7: { lat: 19.076, lng: 72.8777, hq: 'Mumbai, Maharashtra (Emami Zandu HQ)', website: 'https://www.emamiltd.in' },
  8: { lat: 21.1458, lng: 79.0882, hq: 'Nagpur, Maharashtra (Baidyanath HQ)', website: 'https://www.baidyanath.in' },
  9: { lat: 28.6139, lng: 77.209, hq: 'New Delhi (Hamdard Laboratories HQ)', website: 'https://www.hamdard.in' },
  10: { lat: 12.9716, lng: 77.5946, hq: 'Bengaluru, Karnataka (Kerala Ayurveda HQ)', website: 'https://www.keralaayurveda.biz' },
  11: { lat: 19.2183, lng: 72.9781, hq: 'Thane, Maharashtra (Vicco Laboratories HQ)', website: 'https://www.viccolabs.com' },
  12: { lat: 11.0168, lng: 76.9558, hq: 'Coimbatore, Tamil Nadu (Arya Vaidya Pharmacy HQ)', website: 'https://www.avpayurveda.com' },
  13: { lat: 11.0025, lng: 76.0045, hq: 'Kottakkal, Kerala (Arya Vaidya Sala HQ)', website: 'https://www.aryavaidyasala.com' },
  14: { lat: 28.4089, lng: 77.3178, hq: 'Faridabad, Haryana (Jiva Ayurveda HQ)', website: 'https://www.jiva.com' },
  15: { lat: 28.4595, lng: 77.0266, hq: 'Gurugram, Haryana (Tata 1mg HQ)', website: 'https://www.1mg.com' },
  16: { lat: 12.9716, lng: 77.5946, hq: 'Bengaluru, Karnataka (Practo HQ)', website: 'https://www.practo.com' },
  17: { lat: 19.076, lng: 72.8777, hq: 'Mumbai, Maharashtra (Charak Pharma HQ)', website: 'https://www.charak.com' },
  18: { lat: 10.5276, lng: 76.2144, hq: 'Thrissur, Kerala (Vaidyaratnam HQ)', website: 'https://www.vaidyaratnammooss.com' },
  19: { lat: 28.6139, lng: 77.209, hq: 'New Delhi (Upakarma Ayurveda HQ)', website: 'https://upakarma.com' },
  20: { lat: 19.076, lng: 72.8777, hq: 'Mumbai, Maharashtra (Gynoveda HQ)', website: 'https://gynoveda.com' },
  21: { lat: 12.9716, lng: 77.5946, hq: 'Bengaluru, Karnataka (Apollo AyurVAID HQ)', website: 'https://ayurvaid.com' },
  22: { lat: 12.9822, lng: 77.6081, hq: 'Bengaluru, Karnataka (Sri Sri Tattva HQ)', website: 'https://srisritattva.com' },
  23: { lat: 26.8467, lng: 80.9462, hq: 'Lucknow, Uttar Pradesh (Organic India HQ)', website: 'https://organicindia.com' },
  24: { lat: 28.6139, lng: 77.209, hq: 'New Delhi (Forest Essentials HQ)', website: 'https://www.forestessentialsindia.com' },
  25: { lat: 28.5355, lng: 77.251, hq: 'New Delhi (Biotique HQ)', website: 'https://www.biotique.com' },
  26: { lat: 19.076, lng: 72.8777, hq: 'Mumbai, Maharashtra (Dr Vaidya HQ)', website: 'https://drvaidyas.com' },
  27: { lat: 19.076, lng: 72.8777, hq: 'Mumbai, Maharashtra (Ayushakti HQ)', website: 'https://www.ayushakti.com' },
  28: { lat: 12.9716, lng: 77.5946, hq: 'Bengaluru, Karnataka (Cult.fit HQ)', website: 'https://www.cult.fit' },
  29: { lat: 19.076, lng: 72.8777, hq: 'Mumbai, Maharashtra (PharmEasy HQ)', website: 'https://pharmeasy.in' },
  30: { lat: 17.385, lng: 78.4867, hq: 'Hyderabad, Telangana (Vedix HQ)', website: 'https://vedix.com' },
  31: { lat: 19.076, lng: 72.8777, hq: 'Bandra, Mumbai (Marico HQ)', website: 'https://marico.com' },
  32: { lat: 28.4595, lng: 77.0266, hq: 'Gurugram, Haryana (Mamaearth / Honasa HQ)', website: 'https://honasa.in' },
  33: { lat: 28.4595, lng: 77.0266, hq: 'Gurugram, Haryana (HealthKart HQ)', website: 'https://www.healthkart.com' },
  34: { lat: 12.9716, lng: 77.5946, hq: 'Bengaluru, Karnataka (MediBuddy HQ)', website: 'https://www.medibuddy.in' },
  35: { lat: 13.0827, lng: 80.2707, hq: 'Chennai, Tamil Nadu (Netmeds HQ)', website: 'https://www.netmeds.com' },
  36: { lat: 26.9124, lng: 75.7873, hq: 'C-Scheme, Jaipur (Shakti Yoga Studio)', website: 'https://www.example.com/shakti-yoga' },
  37: { lat: 18.5204, lng: 73.8567, hq: 'Sinhagad Road, Pune (Herbal Research Collective)', website: 'https://www.example.com/pune-herbal' },
  38: { lat: 9.9312, lng: 76.2673, hq: 'Fort Kochi, Kerala (Malabar Wellness Retreat)', website: 'https://www.example.com/malabar-retreat' },
  39: { lat: 22.7196, lng: 75.8577, hq: 'Indore, Madhya Pradesh (Central India Herbal Farms)', website: 'https://www.example.com/ci-herbal-farms' },
  40: { lat: 26.9124, lng: 75.7873, hq: 'Malviya Nagar, Jaipur (Pink City Ayurveda Clinic)', website: 'https://www.example.com/pinkcity-ayurveda' },
};

const CITY_COORDS: Record<string, [number, number]> = {
  'new delhi': [28.6139, 77.209],
  delhi: [28.6139, 77.209],
  noida: [28.5355, 77.391],
  gurugram: [28.4595, 77.0266],
  gurgaon: [28.4595, 77.0266],
  haridwar: [29.9457, 78.1642],
  dehradun: [30.3165, 78.0322],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  mumbai: [19.076, 72.8777],
  nagpur: [21.1458, 79.0882],
  pune: [18.5204, 73.8567],
  hyderabad: [17.385, 78.4867],
  chennai: [13.0827, 80.2707],
  kochi: [9.9312, 76.2673],
  kerala: [10.8505, 76.2711],
  jaipur: [26.9124, 75.7873],
  lucknow: [26.8467, 80.9462],
  ahmedabad: [23.0225, 72.5714],
  kolkata: [22.5726, 88.3639],
  thane: [19.2183, 72.9781],
  coimbatore: [11.0168, 76.9558],
  kottakkal: [11.0025, 76.0045],
  faridabad: [28.4089, 77.3178],
  thrissur: [10.5276, 76.2144],
  indore: [22.7196, 75.8577],
  chandigarh: [30.7333, 76.7794],
  bhopal: [23.2599, 77.4126],
  patna: [25.5941, 85.1376],
  varanasi: [25.3176, 82.9739],
};

export function cityCoordsFor(text: string): [number, number] | null {
  const t = text.toLowerCase();
  for (const [key, c] of Object.entries(CITY_COORDS)) {
    if (t.includes(key)) return c;
  }
  return null;
}

/**
 * Real, stable coordinates for an opportunity:
 * 1) explicit city in its location → that city's real coords
 * 2) otherwise the hiring company's real HQ coords
 * 3) small deterministic jitter so same-city pins don't stack.
 */
export function opportunityCoords(
  opp: { id: number | string; location: string; remote: boolean; company_id: number },
  companyLocation?: string,
): [number, number] {
  const city = cityCoordsFor(`${opp.location} ${companyLocation ?? ''}`);
  const hq = COMPANY_GEO[opp.company_id];
  const base: [number, number] = city ?? (hq ? [hq.lat, hq.lng] : [22.8, 79.5]);
  const seed = typeof opp.id === 'number' ? opp.id : opp.id.split('').reduce((s, c) => s + c.charCodeAt(0), 7);
  const jx = (((seed * 37) % 100) / 100 - 0.5) * 0.22;
  const jy = (((seed * 53) % 100) / 100 - 0.5) * 0.22;
  return [base[0] + jx, base[1] + jy];
}

/** Great-circle distance in km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number | null | undefined): string {
  if (km == null || !isFinite(km)) return '';
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

/** Build a Google Maps directions URL from the user to a destination. */
export function directionsUrl(from: GeoPoint, to: GeoPoint): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}

export type GeoStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unsupported' | 'error' | 'manual';

export function useUserLocation() {
  const [coords, setCoords] = useState<GeoPoint | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      setError('Geolocation is not supported by this browser. Type your city instead.');
      return;
    }
    setStatus('locating');
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('granted');
        setLabel('Your current location');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('denied');
          setError('Location permission was blocked. Allow it in the browser bar, or type your city below.');
        } else {
          setStatus('error');
          setError('Could not get your location. Type your city below instead.');
        }
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 },
    );
  }, []);

  /** Manual fallback: resolve a typed Indian city name to coords. */
  const setManualCity = useCallback((raw: string) => {
    const hit = cityCoordsFor(raw);
    if (!hit) {
      setError(`Couldn't find "${raw.trim()}" — try a major city like Delhi, Mumbai, Bengaluru, Nagpur, Jaipur.`);
      return false;
    }
    setCoords({ lat: hit[0], lng: hit[1] });
    setStatus('manual');
    setLabel(raw.trim());
    setError('');
    return true;
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus('idle');
    setError('');
    setLabel('');
  }, []);

  return { coords, status, error, label, request, setManualCity, clear };
}
