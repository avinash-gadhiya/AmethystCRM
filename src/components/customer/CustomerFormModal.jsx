import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Check, ChevronsUpDown, Contact, Lock, MapPin, RefreshCw, Search, UserPlus, UserSearch } from 'lucide-react';
import LiquidGlassButton from '@/components/ui/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { IosToggle } from '@/components/ui/ios-toggle';
import { customerService, countryService } from '@/services';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';
import { serializeQueryParams } from '@/lib/queryParams';
import { getAuthHeaders } from '@/services/http';
import UsPhoneInput from '@/components/common/UsPhoneInput';
import SelectSearchInput from '@/components/common/SelectSearchInput';
import UserOptionBadges, { getUserBadgeSearchText } from '@/components/common/UserOptionBadges';
import { normalizeDigits, validateOptionalUsPhone, validateUsPhone } from '@/lib/usPhone';
import { fetchSalesPersonList } from '@/lib/salesRoles';
import authService from '@/services/authService';

const API_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
const ADDRESS_SEARCH_URL = import.meta.env.VITE_APP_ADDRESS_SEARCH_URL;

// Google Places API (New). Unlike the legacy Places web service it allows
// cross-origin calls, so the browser can query it without a proxy.
// Set VITE_APP_GOOGLE_MAPS_API_KEY to enable it; without a key the modal keeps
// using the free Photon / Nominatim fallback below.
const GOOGLE_PLACES_KEY = import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY;
const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1';

// One token covers "keystrokes + the one details call" and is billed as a
// single session, so it must be regenerated after every pick.
const newAddressSessionToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

const findAddressComponent = (components, type) =>
  (components || []).find((c) => Array.isArray(c?.types) && c.types.includes(type)) || null;

// Google returns typed address components; fold them into the
// { display_name, address } shape the rest of this modal already understands.
const googlePlaceToNominatimLike = (place) => {
  if (!place) return null;

  const components = place.addressComponents || [];
  const longOf = (type) => findAddressComponent(components, type)?.longText || '';
  const shortOf = (type) => findAddressComponent(components, type)?.shortText || '';

  return {
    display_name: place.formattedAddress || '',
    address: {
      house_number: longOf('street_number'),
      road: longOf('route'),
      city:
        longOf('locality') ||
        longOf('postal_town') ||
        longOf('sublocality_level_1') ||
        longOf('sublocality') ||
        longOf('administrative_area_level_3') ||
        longOf('neighborhood'),
      state: longOf('administrative_area_level_1'),
      postcode: longOf('postal_code'),
      country: longOf('country'),
      country_code: String(shortOf('country') || '').toLowerCase(),
    },
    place_id: place.id || '',
    _provider: 'google',
  };
};

const toNominatimLike = (item) => {
  // Normalize different providers into a single shape the rest of the code expects:
  // { display_name: string, address: { ... } }
  if (!item) return null;

  // Nominatim already matches
  if (item?.address && typeof item?.display_name === 'string') return item;

  // Photon returns GeoJSON feature objects
  // https://photon.komoot.io/
  if (item?.type === 'Feature' && item?.properties) {
    const p = item.properties;
    const house = p.housenumber || '';
    const road = p.street || p.name || '';
    const streetLine = [house, road].filter(Boolean).join(' ').trim();
    const city = p.city || p.town || p.village || '';
    const state = p.state || '';
    const postcode = p.postcode || '';
    const country = p.country || '';
    const country_code = p.countrycode || p.country_code || '';

    const display =
      p.name && city
        ? `${p.name}, ${city}${state ? `, ${state}` : ''}${postcode ? ` ${postcode}` : ''}${country ? `, ${country}` : ''}`
        : [streetLine, city, state, postcode, country].filter(Boolean).join(', ');

    return {
      display_name: display || streetLine || city || country || 'Selected address',
      address: {
        house_number: house,
        road,
        city,
        state,
        postcode,
        country,
        country_code,
      },
      // keep ids if present
      place_id: p.osm_id || p.osmId || p.osm_id,
      osm_id: p.osm_id || p.osmId,
      _provider: 'photon',
    };
  }

  return null;
};

const emptyForm = {
  customerId: 0,
  leadId: 0,
  name: '',
  email: '',
  phone: '',
  phone2: '',
  address: '',
  city: '',
  stateId: 0,
  stateName: '',
  zipCode: '',
  countryId: 0,
  countryName: 'USA',
  isActive: true,
  createdBy: 0,
  createdByName: '',
  createdDate: '',
  salesPerson: 0,
  salesPersonName: '',
};


const getZipKind = (countryName) => {
  const name = String(countryName || '').trim().toLowerCase();
  if (!name) return 'OTHER';

  if (name === 'us' || name === 'usa' || name.includes('united states') || name.includes('america')) return 'US';
  if (
    name === 'uk' ||
    name.includes('united kingdom') ||
    name.includes('great britain') ||
    name.includes('england') ||
    name.includes('scotland') ||
    name.includes('wales') ||
    name.includes('northern ireland')
  ) {
    return 'UK';
  }
  if (name === 'au' || name.includes('australia')) return 'AU';
  return 'OTHER';
};

const validateEmail = (value) => {
  const email = String(value || '').trim();
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email';
  return '';
};

const validateZip = (value, countryName) => {
  const kind = getZipKind(countryName);
  const raw = String(value || '').trim();
  if (!raw) return 'Zip Code is required';

  if (kind === 'US') {
    const digits = normalizeDigits(raw);
    if (digits.length < 5 || digits.length > 9) return 'Enter a valid ZIP (5-9 digits)';
    return '';
  }
  if (kind === 'AU') {
    const digits = normalizeDigits(raw);
    if (digits.length !== 4) return 'Enter a valid AU postcode (4 digits)';
    return '';
  }
  if (kind === 'UK') {
    const normalized = raw.toUpperCase().replace(/\s+/g, ' ').trim();
    const uk = /^([A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{2}|[A-Z]{1,2}\d{1,2}[A-Z])\s?\d[A-Z]{2}$/;
    if (!uk.test(normalized)) return 'Enter a valid UK postcode';
    return '';
  }

  const digitsOnly = /^\d+$/.test(raw);
  if (digitsOnly) {
    if (raw.length < 3 || raw.length > 10) return 'Zip Code must be 3-10 digits';
    return '';
  }
  if (raw.length < 3 || raw.length > 12) return 'Zip Code must be 3-12 characters';
  return '';
};

const validateCustomerForm = (data) => {
  const errors = {};

  const salesPerson = Number(data.salesPerson) || 0;
  const stateId = Number(data.stateId) || 0;

  // Lead is optional - a customer can be added without being traced to a lead.
  if (!salesPerson) errors.salesPerson = 'Select Sales Person';

  const name = String(data.name || '').trim();
  if (!name) errors.name = 'Name is required';
  else if (name.length < 2) errors.name = 'Name must be at least 2 characters';

  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;

  const phoneError = validateUsPhone(data.phone, 'Phone');
  if (phoneError) errors.phone = phoneError;

  const phone2Error = validateOptionalUsPhone(data.phone2, 'Phone 2');
  if (phone2Error) errors.phone2 = phone2Error;

  const address = String(data.address || '').trim();
  if (address && address.length < 5) errors.address = 'Address must be at least 5 characters';

  if (!Number(data.countryId)) errors.countryId = 'Wait for the country lookup or retry loading options';
  // A saved state that the country filter happens to exclude is not the user's
  // mistake and must not block Save either - only a missing state is an error.
  // The previous cross-check rejected any state absent from `filteredStates`,
  // which includes every state whose row carries no countryId.
  if (!stateId) errors.stateId = 'Select State';

  const city = String(data.city || '').trim();
  if (!city) errors.city = 'City is required';
  else if (!/^[a-zA-Z][a-zA-Z\s.'-]*$/.test(city)) errors.city = 'City contains invalid characters';

  const zipError = validateZip(data.zipCode, data.countryName);
  if (zipError) errors.zipCode = zipError;

  return errors;
};

// The lead search index keys the name differently depending on the source tab,
// so read every known variant before falling back to what's already in the form.
const pickLeadName = (lead) => String(lead?.customerName || lead?.leadName || lead?.name || '').trim();

const normalizeName = (value) => String(value || '').trim().toLowerCase();

const isUsAddress = (addr) => {
  const code = normalizeName(addr?.country_code || addr?.countrycode);
  if (code === 'us') return true;
  const country = normalizeName(addr?.country);
  return country === 'usa' || country === 'us' || country.includes('united states');
};

const findUsaCountry = (countries) => {
  return (countries || []).find((c) => {
    const name = String(c?.countryName || c?.name || c?.title || '').trim().toLowerCase();
    if (
      name === 'usa' ||
      name === 'us' ||
      name === 'america' ||
      name.includes('united states') ||
      name.includes('u.s.a')
    )
      return true;
    const code = String(c?.countryCode || c?.code || c?.iso2 || c?.iso || c?.iso3 || '').trim().toLowerCase();
    return code === 'us' || code === 'usa';
  });
};

// The API may key the country id differently (countryId / countryID / id / ...).
const getCountryIdValue = (c) =>
  Number(c?.countryId ?? c?.countryID ?? c?.CountryId ?? c?.CountryID ?? c?.id ?? c?.Id ?? c?.ID) || 0;

const pickCityFromAddress = (addr) =>
  addr?.city || addr?.town || addr?.village || addr?.hamlet || addr?.municipality || addr?.county || '';

const buildStreetLine = (addr, fallbackDisplayName = '') => {
  const parts = [];
  const house = addr?.house_number;
  const road = addr?.road || addr?.pedestrian || addr?.footway || addr?.street;
  if (house) parts.push(house);
  if (road) parts.push(road);

  const out = parts.join(' ').trim();
  if (out) return out;
  return String(fallbackDisplayName || '').trim();
};

const focusFirstError = (errors) => {
  const fieldOrder = ['leadId', 'salesPerson', 'name', 'email', 'phone', 'phone2', 'address', 'countryId', 'stateId', 'city', 'zipCode'];
  for (const field of fieldOrder) {
    if (!errors[field]) continue;
    const el = document.querySelector(`[name="${field}"]`) || document.querySelector(`[data-field="${field}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el && typeof el.focus === 'function') el.focus();
    break;
  }
};

// Titled card that groups related fields in a two-column grid.
function FormSection({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700/70 dark:bg-slate-900/40 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
          <Icon size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
          {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

// Label, optional header action, the control itself and its validation message.
function Field({ label, required = false, error, action, className = '', children }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex min-h-[22px] items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
        {action}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

function PickerMessage({ spinning = false, children }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-5 text-center text-sm text-slate-500 dark:text-slate-400">
      {spinning && <RefreshCw className="h-4 w-4 animate-spin" />}
      {children}
    </div>
  );
}

export default function CustomerFormModal({
  open,
  onOpenChange,
  mode = 'add',
  initialValues,
  defaultSalesPersonId,
  canPickSalesPerson = true,
  canAdd = true,
  canUpdate = true,
  title,
  onSaved,
  overlayZIndex = 9999,
}) {
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [salesError, setSalesError] = useState('');
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupVersion, setLookupVersion] = useState(0);

  useEffect(() => {
    if (!open || typeof document === 'undefined' || !document.body) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const [salesPersons, setSalesPersons] = useState([]);
  const [salesPersonsLoading, setSalesPersonsLoading] = useState(false);
  const [salesPersonSearchText, setSalesPersonSearchText] = useState('');
  const [states, setStates] = useState([]);
  const [countries, setCountries] = useState([]);

  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadsRebuilding, setLeadsRebuilding] = useState(false);

  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [stateSearchText, setStateSearchText] = useState('');

  const leadPickerRef = useRef(null);
  const phoneInputRef = useRef(null);
  const phone2InputRef = useRef(null);
  const addressSessionTokenRef = useRef('');

  const filteredStates = useMemo(() => {
    const selectedCountryId = Number(formData.countryId) || 0;
    if (!selectedCountryId) return states;

    const selectedCountryName = String(formData.countryName || '').trim().toLowerCase();

    return (states || []).filter((state) => {
      const stateCountryId = Number(state?.countryId ?? state?.countryID ?? state?.CountryId ?? state?.CountryID ?? 0);
      if (stateCountryId) return stateCountryId === selectedCountryId;

      const stateCountryName = String(state?.countryName ?? state?.country ?? state?.CountryName ?? '').trim().toLowerCase();
      return !!selectedCountryName && stateCountryName === selectedCountryName;
    });
  }, [states, formData.countryId, formData.countryName]);

  // Same guarantee the Sales Person list makes: whatever is currently selected
  // is always among the options. Without it, a saved state that the country
  // filter excludes leaves the trigger on "Select State" even though a state is
  // set - the field looks empty while holding a value.
  const stateOptions = useMemo(() => {
    const list = filteredStates || [];
    const id = Number(formData.stateId) || 0;
    if (!id) return list;
    if (list.some((state) => Number(state?.stateId) === id)) return list;

    const known = (states || []).find((state) => Number(state?.stateId) === id);
    const name = String(formData.stateName || known?.stateName || '').trim();
    return [{ stateId: id, stateName: name || `State ${id}` }, ...list];
  }, [filteredStates, states, formData.stateId, formData.stateName]);

  const visibleStateOptions = useMemo(() => {
    const query = String(stateSearchText || '').trim().toLowerCase();
    if (!query) return stateOptions;
    return stateOptions.filter((state) =>
      String(state?.stateName || state?.name || '').toLowerCase().includes(query),
    );
  }, [stateOptions, stateSearchText]);

  const zipKind = useMemo(() => getZipKind(formData.countryName), [formData.countryName]);

  const fetchLeads = useCallback(async (text = '') => {
    const query = String(text || '').trim();
    if (query.length < 2) {
      setLeads([]);
      setLeadsLoading(false);
      return;
    }

    try {
      setLeadsLoading(true);
      const params = { searchText: query, pageNumber: 1, pageSize: 100 };
      const response = await axios.get(`${API_URL}/Lead/search`, { params, headers: getAuthHeaders() });
      setLeads(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load leads:', error);
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  const searchAddresses = useCallback(async (query) => {
    const q = String(query || '').trim();
    if (q.length < 3) {
      setAddressResults([]);
      return;
    }

    try {
      setAddressLoading(true);
      setAddressPickerOpen(true);

      // No backend required. Provider order:
      // - Optional override: VITE_APP_ADDRESS_SEARCH_URL (your own proxy/provider)
      // - Google Places (New) when VITE_APP_GOOGLE_MAPS_API_KEY is set
      // - Free fallbacks: Photon, then Nominatim
      if (ADDRESS_SEARCH_URL) {
        const res = await fetch(`${ADDRESS_SEARCH_URL}?q=${encodeURIComponent(q)}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Address search failed (${res.status})`);
        const json = await res.json();
        const rawItems = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
        const normalized = rawItems
          .map(toNominatimLike)
          .filter(Boolean)
          .filter((r) => isUsAddress(r?.address));
        setAddressResults(normalized);
        return;
      }

      // Google Places (New) â€” predictions only; the address components come
      // from the details call made when the user picks one.
      if (GOOGLE_PLACES_KEY) {
        try {
          if (!addressSessionTokenRef.current) {
            addressSessionTokenRef.current = newAddressSessionToken();
          }

          const res = await fetch(`${GOOGLE_PLACES_BASE}/places:autocomplete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
            },
            body: JSON.stringify({
              input: q,
              includedRegionCodes: ['us'],
              sessionToken: addressSessionTokenRef.current,
            }),
          });
          if (!res.ok) throw new Error(`Google Places autocomplete failed (${res.status})`);

          const json = await res.json();
          const suggestions = Array.isArray(json?.suggestions) ? json.suggestions : [];
          const normalized = suggestions
            .map((s) => s?.placePrediction)
            .filter((p) => p?.placeId)
            .map((p) => ({
              place_id: p.placeId,
              display_name:
                p?.text?.text ||
                [p?.structuredFormat?.mainText?.text, p?.structuredFormat?.secondaryText?.text]
                  .filter(Boolean)
                  .join(', '),
              _provider: 'google',
              _needsDetails: true,
            }))
            .filter((r) => r.display_name)
            .slice(0, 8);

          setAddressResults(normalized);
          return;
        } catch (error) {
          console.error('Google Places search failed, falling back to OSM:', error);
        }
      }

      // Photon
      try {
        const photonParams = serializeQueryParams({ q, limit: '12' });
        const res = await fetch(`https://photon.komoot.io/api/?${photonParams}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Photon failed (${res.status})`);
        const json = await res.json();
        const features = Array.isArray(json?.features) ? json.features : [];
        const normalized = features
          .map(toNominatimLike)
          .filter(Boolean)
          .filter((r) => isUsAddress(r?.address))
          .slice(0, 8);
        setAddressResults(normalized);
        return;
      } catch (e) {
        // fall through to Nominatim
      }

      // Nominatim fallback
      const params = serializeQueryParams({ q, format: 'json', addressdetails: '1', limit: '8', countrycodes: 'us' });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Nominatim failed (${res.status})`);
      const json = await res.json();
      const rawItems = Array.isArray(json) ? json : [];
      const normalized = rawItems
        .map(toNominatimLike)
        .filter(Boolean)
        .filter((r) => isUsAddress(r?.address));
      setAddressResults(normalized);
    } catch (error) {
      console.error('Address search error:', error);
      setAddressResults([]);
    } finally {
      setAddressLoading(false);
    }
  }, []);

  const applyAddressResult = useCallback(
    (result) => {
      const addr = result?.address || {};
      const streetLine = buildStreetLine(addr, result?.display_name);
      const city = pickCityFromAddress(addr);
      const zip = addr?.postcode || '';
      const stateName = addr?.state || addr?.region || '';

      setFormData((prev) => {
        // Only fill address / city / zip. The Country is a fixed (read-only)
        // value, so an address pick must never change it.
        const seeded = {
          ...prev,
          address: streetLine || prev.address,
          city: city || prev.city,
          zipCode: zip || prev.zipCode,
        };

        // Match the picked address's state within the current (unchanged)
        // country, then fall back to the full list. The strict countryId filter
        // alone found nothing whenever state rows carry no countryId, which
        // dropped a perfectly good state off an address the user just picked.
        const byName = (list) =>
          (list || []).find((s) => normalizeName(s?.stateName) === normalizeName(stateName));

        const targetCountryId = Number(prev.countryId) || 0;
        const candidateStates = targetCountryId
          ? (states || []).filter((s) => Number(s?.countryId ?? s?.countryID ?? s?.CountryId ?? s?.CountryID ?? 0) === targetCountryId)
          : states || [];

        const matchedState = stateName ? byName(candidateStates) || byName(states) : null;

        const withState = matchedState
          ? {
              ...seeded,
              stateId: Number(matchedState.stateId) || 0,
              stateName: matchedState.stateName || stateName,
            }
          : stateName
          ? { ...seeded, stateId: 0, stateName }
          : seeded;

        if (showValidationErrors) setFormErrors(validateCustomerForm(withState));
        return withState;
      });
    },
    [states, showValidationErrors],
  );

  // Google predictions carry no address components, so the picked place has to
  // be resolved before the city / state / ZIP fields can be filled.
  const handlePickAddress = useCallback(
    async (result) => {
      if (result?._provider !== 'google' || !result?._needsDetails) {
        applyAddressResult(result);
        return;
      }

      try {
        setAddressLoading(true);

        const token = addressSessionTokenRef.current;
        const url = `${GOOGLE_PLACES_BASE}/places/${encodeURIComponent(result.place_id)}${
          token ? `?sessionToken=${encodeURIComponent(token)}` : ''
        }`;
        const res = await fetch(url, {
          headers: {
            'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
            'X-Goog-FieldMask': 'id,formattedAddress,addressComponents',
          },
        });
        if (!res.ok) throw new Error(`Google Place details failed (${res.status})`);

        const detailed = googlePlaceToNominatimLike(await res.json());
        if (!detailed) throw new Error('Google Place details returned no address');
        applyAddressResult(detailed);
      } catch (error) {
        console.error('Address details error:', error);
        toast.error('Could not load the selected address. Please enter it manually.');
      } finally {
        // The details call closes the billing session; the next search opens a new one.
        addressSessionTokenRef.current = '';
        setAddressLoading(false);
      }
    },
    [applyAddressResult],
  );

  const rebuildLeadIndex = useCallback(async () => {
    try {
      setLeadsRebuilding(true);
      await axios.post(`${API_URL}/Lead/index/rebuild`, null, { headers: getAuthHeaders() });
      await fetchLeads(leadSearch);
      toast.success('Leads refreshed');
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Failed to refresh leads');
    } finally {
      setLeadsRebuilding(false);
    }
  }, [fetchLeads, leadSearch]);

  // Fetch authenticated choices when the customer form is opened.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setSalesPersonsLoading(true);
    setSalesError('');
    fetchSalesPersonList({ pageSize: 1000 })
      .then((users) => { if (active) setSalesPersons(Array.isArray(users) ? users : []); })
      .catch((error) => { if (active) setSalesError(getApiErrorMessage(error, 'Failed to load sales people.')); })
      .finally(() => { if (active) setSalesPersonsLoading(false); });
    return () => { active = false; };
  }, [open, lookupVersion]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLookupsLoading(true);
    setLookupError('');
    const loadLookups = async () => {
      try {
        const result = await countryService.getCountryDropdown();
        let rows = result.data || [];
        const savedCountryId = mode === 'edit' ? Number(initialValues?.countryId) || 0 : 0;
        if (!savedCountryId && !findUsaCountry(rows)) {
          const fullList = await countryService.getCountries({ PageNumber: 1, PageSize: 1000, IsDescending: false });
          rows = fullList.data || rows;
        }
        const country = savedCountryId ? rows.find((row) => getCountryIdValue(row) === savedCountryId) : findUsaCountry(rows);
        const countryId = savedCountryId || getCountryIdValue(country);
        if (!countryId) throw new Error('USA is missing from the Country API. Add the country or retry loading options.');
        const countryName = savedCountryId ? country?.countryName || initialValues?.countryName || '' : 'USA';
        const stateRows = await countryService.getStates({ CountryId: countryId, PageNumber: 1, PageSize: 1000, countryName });
        if (!active) return;
        if (!Array.isArray(stateRows) || !stateRows.length) throw new Error('No states were returned for the selected country.');
        setCountries(rows);
        setStates(stateRows);
        setFormData((prev) => ({ ...prev, countryId, countryName }));
      } catch (error) {
        if (active) setLookupError(getApiErrorMessage(error, 'Failed to load countries and states.'));
      } finally {
        if (active) setLookupsLoading(false);
      }
    };
    loadLookups();
    return () => { active = false; };
  }, [open, mode, initialValues?.countryId, initialValues?.countryName, lookupVersion]);

  useEffect(() => {
    if (!open) return;

    const user = authService.getUser() || {};
    const userId = Number(user.userId) || 0;
    const userName = user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.userName || '';

    const raw = initialValues || {};
    const seed = {
      ...emptyForm,
      ...raw,
      name: raw.name ?? '',
      email: raw.email ?? '',
      phone: raw.phone ?? '',
      phone2: raw.phone2 ?? '',
      address: raw.address ?? '',
      city: raw.city ?? '',
      stateName: raw.stateName ?? '',
      zipCode: raw.zipCode ?? '',
      countryName: raw.countryName ?? 'USA',
      salesPersonName: raw.salesPersonName ?? '',
    };

    // Country is fixed to USA. Never let an empty initialValues blank it out.
    if (!String(seed.countryName || '').trim()) seed.countryName = 'USA';

    if (mode === 'add') {
      seed.customerId = 0;
      // No Status toggle on the add form, so a new customer is always Active -
      // pinned here so a stray initialValues can't send it through as inactive.
      seed.isActive = true;

      seed.createdBy = seed.createdBy || userId;
      seed.createdByName = seed.createdByName || userName;
      seed.createdDate = seed.createdDate || new Date().toISOString();

      if (!Number(seed.salesPerson) && Number(defaultSalesPersonId)) {
        seed.salesPerson = Number(defaultSalesPersonId);
      }

      // The picker is disabled for these logins, so there is no way to correct
      // an empty value - fall back to the logged-in user.
      if (!canPickSalesPerson && !Number(seed.salesPerson) && userId) {
        seed.salesPerson = userId;
        seed.salesPersonName = seed.salesPersonName || userName;
      }
    }

    setFormData(seed);
    setSaveError('');
    setFormErrors({});
    setShowValidationErrors(false);
    setLeadSearch('');
    setSalesPersonSearchText('');
    setStateSearchText('');
    setLeadPickerOpen(false);

    setAddressSearch('');
    setAddressPickerOpen(false);
    setAddressResults([]);
    addressSessionTokenRef.current = '';

  }, [open, initialValues, mode, defaultSalesPersonId, canPickSalesPerson, fetchLeads]);

  // Country is fixed to USA. Split out of the seeding effect above so it no
  // longer depends on the lookups arriving in the same tick - it now runs
  // whenever the form is seeded AND the lists are in hand, in either order.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && Number(initialValues?.countryId) > 0) return;
    if (!countries || countries.length === 0) return;

    const usa = findUsaCountry(countries);
    if (!usa) return;

    const usaId = getCountryIdValue(usa);
    const usaName = 'USA';

    setFormData((prev) => {
      const currentStateId = Number(prev.stateId) || 0;
      const currentState = currentStateId
        ? (states || []).find((s) => Number(s?.stateId) === currentStateId)
        : null;
      const currentStateCountryId = Number(
        currentState?.countryId ?? currentState?.countryID ?? currentState?.CountryId ?? currentState?.CountryID ?? 0,
      );

      // Only drop the saved state when it provably belongs to a DIFFERENT
      // country. This used to require a positive match, so a state row carrying
      // no countryId - or one missing from the fetched page - silently cleared
      // the customer's state on open, and Save then wrote that blank back.
      // Keeping it is always the safer default: the field is required, so a
      // genuinely wrong value still has to be corrected before saving.
      const belongsToOtherCountry = !!currentStateCountryId && currentStateCountryId !== usaId;
      const keepState = !!currentStateId && !belongsToOtherCountry;

      const nextStateId = keepState ? prev.stateId : 0;
      const nextStateName = keepState ? prev.stateName : '';

      // Bail out when nothing actually changes, so this cannot loop on its own
      // output once the lists settle.
      if (
        Number(prev.countryId) === usaId &&
        prev.countryName === usaName &&
        prev.stateId === nextStateId &&
        prev.stateName === nextStateName
      ) {
        return prev;
      }

      return {
        ...prev,
        countryId: usaId,
        countryName: usaName,
        stateId: nextStateId,
        stateName: nextStateName,
      };
    });
  }, [open, countries, states, mode, initialValues?.countryId]);

  // The dropdown is intentionally limited to sales roles. Do not inject a
  // historical admin/developer assignment back into the selectable options.
  const salesPersonOptions = useMemo(() => {
    return salesPersons || [];
  }, [salesPersons]);

  const visibleSalesPersonOptions = useMemo(() => {
    const query = String(salesPersonSearchText || '').trim().toLowerCase();
    if (!query) return salesPersonOptions;

    return salesPersonOptions.filter((user) => {
      const displayName =
        [user?.firstName, user?.lastName].filter(Boolean).join(' ')
        || user?.name
        || user?.fullName
        || user?.userName
        || '';
      return String(displayName).toLowerCase().includes(query) || getUserBadgeSearchText(user).includes(query);
    });
  }, [salesPersonOptions, salesPersonSearchText]);

  // With the picker locked, no selection ever fills the display name - resolve
  // it from the user list once that has loaded, so the disabled field shows a
  // name instead of sitting on the placeholder.
  useEffect(() => {
    if (!open) return;
    if (canPickSalesPerson) return;

    const id = Number(formData.salesPerson) || 0;
    if (!id) return;
    if (String(formData.salesPersonName || '').trim()) return;

    const match = (salesPersons || []).find((user) => Number(user?.userId) === id);
    if (!match) return;

    const displayName =
      [match.firstName, match.lastName].filter(Boolean).join(' ')
      || match.name
      || match.fullName
      || match.userName
      || '';
    if (!displayName) return;

    setFormData((prev) => ({ ...prev, salesPersonName: displayName }));
  }, [open, canPickSalesPerson, salesPersons, formData.salesPerson, formData.salesPersonName]);

  // The reverse repair: a customer that arrives with a sales person NAME but no
  // id leaves the Select with no value, so it sits on "Select Sales Person"
  // even though the customer plainly has one. Recover the id by name once the
  // list has loaded - it is fetched per open, so on a slow response the first
  // render genuinely has nothing to match against.
  useEffect(() => {
    if (!open) return;
    if (Number(formData.salesPerson) > 0) return;

    const wanted = normalizeName(formData.salesPersonName);
    if (!wanted) return;

    const match = (salesPersons || []).find((user) =>
      [
        user?.fullName,
        user?.name,
        [user?.firstName, user?.lastName].filter(Boolean).join(' '),
        user?.userName,
      ].some((candidate) => normalizeName(candidate) === wanted),
    );

    const id = Number(match?.userId) || 0;
    if (!id) return;

    setFormData((prev) => (Number(prev.salesPerson) > 0 ? prev : { ...prev, salesPerson: id }));
  }, [open, salesPersons, formData.salesPerson, formData.salesPersonName]);

  useEffect(() => {
    if (!open) return;
    const q = String(addressSearch || '').trim();
    if (q.length < 3) {
      setAddressResults([]);
      return;
    }

    const id = setTimeout(() => {
      searchAddresses(q);
    }, 450);

    return () => clearTimeout(id);
  }, [open, addressSearch, searchAddresses]);

  useEffect(() => {
    if (!open) return;
    if (!leadPickerOpen) return;

    const id = setTimeout(() => {
      fetchLeads(leadSearch);
    }, 350);

    return () => clearTimeout(id);
  }, [open, leadPickerOpen, leadSearch, fetchLeads]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let nextValue = type === 'checkbox' ? checked : value;

    if (name === 'zipCode') {
      const kind = getZipKind(formData.countryName);
      if (kind === 'UK') {
        nextValue = String(nextValue || '')
          .toUpperCase()
          .replace(/[^A-Z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .slice(0, 10);
      } else {
        const max = kind === 'AU' ? 4 : 9;
        nextValue = normalizeDigits(nextValue).slice(0, max);
      }
    }

    if (name === 'city') {
      nextValue = String(nextValue || '').replace(/\s+/g, ' ');
    }

    setFormData((prev) => {
      const next = { ...prev, [name]: nextValue };
      if (showValidationErrors) setFormErrors(validateCustomerForm(next));
      return next;
    });
  };

  const handleAddressChange = (e) => {
    handleInputChange(e);
    const next = String(e?.target?.value || '');
    setAddressSearch(next);
    const q = next.trim();
    // Close stale results while the debounced lookup catches up. The popover is
    // reopened by searchAddresses with an honest loading/result state.
    setAddressPickerOpen(false);
    setAddressResults([]);
    if (q.length < 3) setAddressLoading(false);
  };

  const handleUsPhoneChange = (fieldName) => (nextValue) => {
    setFormData((prev) => {
      const next = { ...prev, [fieldName]: nextValue };
      if (showValidationErrors) setFormErrors(validateCustomerForm(next));
      return next;
    });
  };

  const handleStateChange = (value) => {
    const id = value ? Number(value) : 0;
    // Look through every option actually offered, not just the country-filtered
    // set - the currently selected state can be an injected entry that the
    // filter excluded, and missing it here would blank stateName on re-pick.
    const selected =
      (stateOptions || []).find((s) => Number(s.stateId) === id) ||
      (states || []).find((s) => Number(s.stateId) === id);

    setFormData((prev) => {
      const next = { ...prev, stateId: id, stateName: selected?.stateName || prev.stateName || '' };
      if (showValidationErrors) setFormErrors(validateCustomerForm(next));
      return next;
    });
  };

  const handleSalesPersonChange = (value) => {
    const id = value ? Number(value) : 0;
    const selected = (salesPersons || []).find((u) => Number(u.userId) === id);
    const displayName =
      selected
        ? ([selected.firstName, selected.lastName].filter(Boolean).join(' ') || selected.name || selected.fullName || selected.userName || '')
        : '';

    setFormData((prev) => {
      const next = { ...prev, salesPerson: id, salesPersonName: displayName };
      if (showValidationErrors) setFormErrors(validateCustomerForm(next));
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (mode === 'edit' ? !canUpdate : !canAdd) {
      setSaveError('You do not have permission to save this customer.');
      return;
    }
    if (lookupsLoading || salesPersonsLoading) return;
    setSaveError('');
    setShowValidationErrors(true);
    const errors = validateCustomerForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      focusFirstError(errors);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    let saved;
    try {
      const payload = {
        ...formData,
        phone: normalizeDigits(formData.phone),
        phone2: formData.phone2 ? normalizeDigits(formData.phone2) : '',
        leadId: Number(formData.leadId) || 0,
        stateId: Number(formData.stateId) || 0,
        countryId: Number(formData.countryId) || 0,
        salesPerson: Number(formData.salesPerson) || 0,
        createdDate: formData.createdDate || new Date().toISOString(),
      };

      saved = mode === 'edit' ? await customerService.updateCustomer(payload) : await customerService.createCustomer(payload);
    } catch (error) {
      const errors = error?.payload?.errors || error?.response?.data?.errors;
      const details = errors && typeof errors === 'object' ? Object.values(errors).flat().join(' ') : '';
      const message = details || getApiErrorMessage(error, mode === 'edit' ? 'Failed to update customer' : 'Failed to create customer');
      setSaveError(message);
      toast.error(message);
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    toast.success(mode === 'edit' ? 'Customer updated' : 'Customer created');
    if (typeof onSaved === 'function') onSaved(saved);
    if (typeof onOpenChange === 'function') onOpenChange(false);
  };

  // The lead list floats over the form, so close it on any click outside the picker.
  useEffect(() => {
    if (!leadPickerOpen) return undefined;
    const handlePointerDown = (event) => {
      if (leadPickerRef.current && !leadPickerRef.current.contains(event.target)) setLeadPickerOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setLeadPickerOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [leadPickerOpen]);

  if (!open) return null;

  const modalTitle = title || (mode === 'edit' ? 'Edit Customer' : 'Add Customer');
  const contentZ = overlayZIndex + 10;
  const popupZ = overlayZIndex + 20;
  const rootEl = typeof document !== 'undefined' ? document.documentElement : null;
  const bodyEl = typeof document !== 'undefined' ? document.body : null;
  const isDarkClass =
    !!rootEl?.classList?.contains('dark') ||
    !!bodyEl?.classList?.contains('dark');
  const themeMode =
    rootEl?.getAttribute('data-theme-mode') ||
    bodyEl?.getAttribute('data-theme-mode') ||
    (isDarkClass ? 'dark' : null);
  const modalRootClass = isDarkClass || themeMode === 'dark' ? 'dark' : undefined;
  const modalInputClass =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-xs outline-none transition-all placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500';
  // Same box as the inputs for dropdown-style triggers (the shared SelectTrigger has no border of its own).
  const selectFieldClass =
    'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-left text-sm font-normal text-slate-900 shadow-xs outline-none transition-all hover:border-slate-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 data-[state=open]:border-violet-500 data-[state=open]:ring-4 data-[state=open]:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
  const errorFieldClass = 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10';
  const selectedLead = (leads || []).find((lead) => Number(lead.leadId) === Number(formData.leadId));
  const selectedLeadName = selectedLead?.leadName || selectedLead?.name || selectedLead?.customerName || formData.name || '';

  return createPortal(
    <div
      data-modal-root="true"
      data-theme-mode={themeMode || undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-form-modal-title"
      className={cn('fixed inset-0 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200', modalRootClass)}
      style={{ zIndex: overlayZIndex }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !savingRef.current) onOpenChange?.(false);
      }}
    >
      <div
        data-modal-surface="true"
        className="customer-form-modal relative my-auto flex w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-[0_25px_70px_-15px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#141122] animate-in zoom-in-95 duration-200"
        style={{ zIndex: contentZ }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-violet-50/70 via-white to-indigo-50/50 px-5 py-4 dark:border-white/10 dark:from-violet-500/10 dark:via-[#141122] dark:to-indigo-500/10 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/25">
              <UserPlus size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 id="customer-form-modal-title" className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">{modalTitle}</h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Provide customer details below.</p>
            </div>
          </div>
          <GlassCloseButton disabled={saving} onClick={() => !savingRef.current && onOpenChange?.(false)} className="ml-4 shrink-0 !h-9 !w-9 !rounded-xl dark:!border-white/10 dark:!bg-white/5 dark:!text-slate-300" />
        </div>

        <form onSubmit={handleSubmit} noValidate autoComplete="off" aria-busy={saving} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <fieldset disabled={saving} className="contents">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-slate-50/40 p-4 dark:bg-black/10 sm:p-6">
            {saveError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>}
            {(lookupError || salesError) && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{[lookupError, salesError].filter(Boolean).join(' ')}</p>
              <button type="button" className="mt-2 font-semibold underline" disabled={saving || lookupsLoading || salesPersonsLoading} onClick={() => setLookupVersion((value) => value + 1)}>Retry loading options</button>
            </div>}
            {(lookupsLoading || salesPersonsLoading) && <p role="status" className="text-sm text-slate-500">Loading customer options...</p>}
            {showValidationErrors && Object.keys(formErrors).length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">Please fix the highlighted fields.</div>
            )}

          <FormSection icon={UserSearch} title="Lead & Owner" description="Link the customer to a lead and choose who owns the account.">
            <Field
              label="Lead"
              error={showValidationErrors && formErrors.leadId}
              action={(
                <button
                  type="button"
                  onClick={rebuildLeadIndex}
                  disabled={leadsLoading || leadsRebuilding}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-violet-300 dark:hover:bg-violet-500/10"
                  title="Refresh lead search index"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', leadsRebuilding && 'animate-spin')} />
                  Refresh
                </button>
              )}
            >
              <div ref={leadPickerRef} className="relative">
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={leadPickerOpen}
                  aria-haspopup="listbox"
                  onClick={() => setLeadPickerOpen((current) => !current)}
                  className={cn(
                    selectFieldClass,
                    'customer-form-field',
                    leadPickerOpen && 'border-violet-500 ring-4 ring-violet-500/10',
                    showValidationErrors && formErrors.leadId && errorFieldClass,
                  )}
                  data-field="leadId"
                >
                  {selectedLead || formData.leadId ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-100 text-[11px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                        #{formData.leadId}
                      </span>
                      <span className="truncate text-slate-900 dark:text-white">{selectedLeadName || `Lead #${formData.leadId}`}</span>
                    </span>
                  ) : (
                    <span className="truncate text-slate-400">Search and select a lead</span>
                  )}
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                </button>

                {leadPickerOpen && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
                    style={{ zIndex: popupZ }}
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        autoFocus
                        placeholder="Name, email or phone..."
                        value={leadSearch}
                        onValueChange={setLeadSearch}
                      />
                      <CommandList className="max-h-60 border-t border-slate-100 dark:border-slate-800">
                        {leadSearch.trim().length < 2 ? (
                          <PickerMessage>Type at least 2 characters to search leads.</PickerMessage>
                        ) : leadsLoading ? (
                          <PickerMessage spinning>Searching leads...</PickerMessage>
                        ) : (leads || []).length === 0 ? (
                          <PickerMessage>No leads match &ldquo;{leadSearch.trim()}&rdquo;.</PickerMessage>
                        ) : (
                          <CommandGroup>
                            {(leads || []).map((lead) => {
                              const leadId = Number(lead.leadId) || 0;
                              const leadName = lead.leadName || lead.name || lead.customerName || '';
                              const leadMeta = [lead.email, lead.phone].filter(Boolean).join(' · ');
                              const isSelected = Number(formData.leadId) === leadId;
                              return (
                                <CommandItem
                                  key={leadId}
                                  value={String(leadId)}
                                  onSelect={() => {
                                    const pickedName = pickLeadName(lead);
                                    setFormData((prev) => {
                                      const next = { ...prev, leadId, name: pickedName || prev.name };
                                      if (showValidationErrors) setFormErrors(validateCustomerForm(next));
                                      return next;
                                    });
                                    setLeadPickerOpen(false);
                                  }}
                                  className={cn(
                                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 data-[selected=true]:bg-violet-50 dark:data-[selected=true]:bg-violet-500/10',
                                    isSelected && 'bg-violet-50/70 dark:bg-violet-500/10',
                                  )}
                                >
                                  <Check className={cn('h-4 w-4 shrink-0 text-violet-600', isSelected ? 'opacity-100' : 'opacity-0')} />
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{leadName || `Lead #${leadId}`}</div>
                                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                                      {[`#${leadId}`, leadMeta].filter(Boolean).join(' · ')}
                                    </div>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </div>
                )}
              </div>
            </Field>

            <Field label="Sales Person" required error={showValidationErrors && formErrors.salesPerson}>
              <Select
                value={formData.salesPerson ? String(formData.salesPerson) : ''}
                onValueChange={(value) => {
                  setSalesPersonSearchText('');
                  handleSalesPersonChange(value);
                }}
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) setSalesPersonSearchText('');
                }}
                disabled={!canPickSalesPerson || saving || salesPersonsLoading}
              >
                <SelectTrigger
                  className={cn(
                    selectFieldClass,
                    'customer-form-field',
                    !canPickSalesPerson && 'cursor-not-allowed bg-slate-100 text-slate-600 disabled:opacity-100 dark:bg-slate-900/60',
                    showValidationErrors && formErrors.salesPerson && errorFieldClass,
                  )}
                  data-field="salesPerson"
                >
                  <SelectValue placeholder="Select Sales Person" />
                </SelectTrigger>
                <SelectContent
                  className="max-h-80"
                  style={{ zIndex: popupZ }}
                  search={(
                    <SelectSearchInput
                      value={salesPersonSearchText}
                      onChange={setSalesPersonSearchText}
                      placeholder="Search sales agents or managers..."
                    />
                  )}
                >
                  {salesPersonsLoading ? (
                    <PickerMessage spinning>Loading users...</PickerMessage>
                  ) : visibleSalesPersonOptions.length === 0 ? (
                    <PickerMessage>No sales persons found.</PickerMessage>
                  ) : (
                    visibleSalesPersonOptions.map((user) => (
                      <SelectItem key={user.userId} value={String(user.userId)} meta={<UserOptionBadges user={user} />}>
                        {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.fullName || user.userName || `User ${user.userId}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <FormSection icon={Contact} title="Contact Details" description="How the team reaches this customer.">
            {[
              { name: 'name', label: 'Full Name', required: true, placeholder: 'e.g. John Smith', autoComplete: 'off' },
              { name: 'email', label: 'Email', required: true, placeholder: 'name@example.com', inputMode: 'email', autoComplete: 'off' }
            ].map((field) => (
              <Field key={field.name} label={field.label} required={field.required} error={showValidationErrors && formErrors[field.name]}>
                <input
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleInputChange}
                  required={field.required}
                  placeholder={field.placeholder}
                  inputMode={field.inputMode}
                  autoComplete={field.autoComplete}
                  className={cn(modalInputClass, showValidationErrors && formErrors[field.name] && errorFieldClass)}
                />
              </Field>
            ))}
            {[
              { name: 'phone', label: 'Phone', required: true, ref: phoneInputRef },
              { name: 'phone2', label: 'Alternate Phone', required: false, ref: phone2InputRef }
            ].map((field) => (
              <Field key={field.name} label={field.label} required={field.required} error={showValidationErrors && formErrors[field.name]}>
                <UsPhoneInput
                  name={field.name}
                  ref={field.ref}
                  value={formData[field.name]}
                  onChange={handleUsPhoneChange(field.name)}
                  required={field.required}
                  className={cn(modalInputClass, showValidationErrors && formErrors[field.name] && errorFieldClass)}
                />
              </Field>
            ))}
          </FormSection>

          <FormSection icon={MapPin} title="Address" description="Start typing and pick a suggestion to fill city, state and zip.">
            <Field label="Street Address" error={showValidationErrors && formErrors.address} className="md:col-span-2">
              <Popover open={addressPickerOpen} onOpenChange={setAddressPickerOpen} modal={false}>
                <PopoverTrigger asChild>
                  <div className="relative w-full">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      name="address"
                      autoComplete="new-password"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      spellCheck={false}
                      value={formData.address}
                      onChange={handleAddressChange}
                      onFocus={() => {
                        const q = String(addressSearch || formData.address || '').trim();
                        if (q.length >= 3 && (addressLoading || addressResults.length > 0)) setAddressPickerOpen(true);
                      }}
                      className={cn(`${modalInputClass} pl-10 pr-10`, showValidationErrors && formErrors.address && errorFieldClass)}
                      placeholder="Start typing an address..."
                    />
                    {addressLoading && (
                      <RefreshCw className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-violet-500" />
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
                  align="start"
                  style={{ zIndex: popupZ }}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <Command>
                    <CommandList className="max-h-64">
                      <CommandEmpty className="px-4 py-5 text-center text-sm text-slate-500 dark:text-slate-400">
                        {addressLoading ? 'Searching addresses...' : 'No matching addresses. Keep typing or fill the fields below.'}
                      </CommandEmpty>
                      <CommandGroup className="p-1">
                        {(addressResults || []).map((r) => {
                          const key = String(r?.place_id ?? r?.osm_id ?? r?.display_name ?? Math.random());
                          const label = String(r?.display_name || '').trim();
                          if (!label) return null;
                          return (
                            <CommandItem
                              key={key}
                              value={label}
                              onSelect={() => {
                                handlePickAddress(r);
                                setAddressSearch(label);
                                setAddressPickerOpen(false);
                              }}
                              className="flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 data-[selected=true]:bg-violet-50 dark:data-[selected=true]:bg-violet-500/10"
                            >
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                              <span className="text-sm leading-snug text-slate-700 dark:text-slate-200">{label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            <Field label="City" required error={showValidationErrors && formErrors.city}>
              <input
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                required
                placeholder="City"
                className={cn(modalInputClass, showValidationErrors && formErrors.city && errorFieldClass)}
              />
            </Field>

            <Field label="State" required error={showValidationErrors && formErrors.stateId}>
              <Select
                value={formData.stateId ? String(formData.stateId) : ''}
                disabled={saving || lookupsLoading}
                onValueChange={(value) => {
                  setStateSearchText('');
                  handleStateChange(value);
                }}
                // Drop a stale query on close so it can never hide the selected
                // option, which would blank the trigger.
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) setStateSearchText('');
                }}
              >
                <SelectTrigger
                  className={cn(selectFieldClass, 'customer-form-field', showValidationErrors && formErrors.stateId && errorFieldClass)}
                  data-field="stateId"
                >
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent
                  className="max-h-72"
                  style={{ zIndex: popupZ }}
                  search={<SelectSearchInput value={stateSearchText} onChange={setStateSearchText} placeholder="Search state..." />}
                >
                  {visibleStateOptions.length === 0 ? (
                    <PickerMessage>No states found.</PickerMessage>
                  ) : (
                    visibleStateOptions.map((state) => (
                      <SelectItem key={state.stateId} value={String(state.stateId)}>
                        {state.stateName || state.name || `State ${state.stateId}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Zip Code" required error={showValidationErrors && formErrors.zipCode}>
              <input
                name="zipCode"
                value={formData.zipCode}
                onChange={handleInputChange}
                required
                inputMode={zipKind === 'UK' ? 'text' : 'numeric'}
                pattern={zipKind === 'UK' ? '[A-Za-z0-9 ]*' : '\\d*'}
                maxLength={zipKind === 'UK' ? 10 : zipKind === 'US' ? 9 : zipKind === 'AU' ? 4 : 10}
                placeholder={zipKind === 'UK' ? 'SW1A 1AA' : zipKind === 'AU' ? '2000' : '12345'}
                className={cn(modalInputClass, showValidationErrors && formErrors.zipCode && errorFieldClass)}
              />
            </Field>

            <Field label="Country" required error={showValidationErrors && formErrors.countryId}>
              <div
                className={cn(
                  `${modalInputClass} flex cursor-not-allowed items-center justify-between bg-slate-100 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300`,
                  showValidationErrors && formErrors.countryId && errorFieldClass,
                )}
                data-field="countryId"
                title={formData.countryName || 'USA'}
              >
                <span>{mode === 'edit' && getZipKind(formData.countryName) !== 'US' ? formData.countryName : 'United States (USA)'}</span>
                <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              </div>
            </Field>
          </FormSection>

          {/* A brand new customer is always created Active, so the toggle only
              earns its place once there is a status to change. */}
          {mode === 'edit' && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs dark:border-slate-700 dark:bg-slate-900/40">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Customer Status</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{formData.isActive ? 'This customer is active.' : 'This customer is inactive.'}</div>
              </div>
              <IosToggle
                checked={!!formData.isActive}
                onCheckedChange={(nextChecked) => setFormData((prev) => ({ ...prev, isActive: !!nextChecked }))}
                title={formData.isActive ? 'Active' : 'Inactive'}
              />
            </div>
          )}

          </div>
          </fieldset>

          <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-slate-200/80 bg-slate-50/50 px-5 py-3.5 dark:border-white/10 dark:bg-[#141122] sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <button
              type="button"
              disabled={saving}
              onClick={() => !savingRef.current && onOpenChange?.(false)}
              className="h-10 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all shadow-xs"
            >
              Cancel
            </button>
            <LiquidGlassButton
              type="submit"
              disabled={saving || lookupsLoading || salesPersonsLoading || (mode === 'edit' ? !canUpdate : !canAdd)}
              className="!h-10 !rounded-xl px-6 text-center !text-sm !font-semibold shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
            >
              {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Customer'}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>
  , document.body);
}
