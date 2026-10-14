import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Check, ChevronsUpDown, RefreshCw, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LiquidGlassButton from '@/components/ui/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { IosToggle } from '@/components/ui/ios-toggle';
import { customerService, countryService, userService } from '@/services';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';
import { serializeQueryParams } from '@/lib/queryParams';
import { getAuthHeaders } from '@/services/http';
import UsPhoneInput from '@/components/common/UsPhoneInput';
import SelectSearchInput from '@/components/common/SelectSearchInput';
import UserOptionBadges, { getUserBadgeSearchText } from '@/components/common/UserOptionBadges';
import { normalizeDigits, validateOptionalUsPhone, validateUsPhone } from '@/lib/usPhone';

const API_URL = import.meta.env.VITE_APP_API_URL;
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

  // Country is a fixed, read-only USA value that the user cannot change, so it
  // must never block Save. (Its id is still resolved and sent when available.)
  //
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

const isUsaCountryName = (name) => {
  const n = String(name || '').trim().toLowerCase();
  return n === 'usa' || n === 'us' || n === 'america' || n.includes('united states') || n.includes('u.s.a');
};

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

export default function CustomerFormModal({
  open,
  onOpenChange,
  mode = 'add',
  initialValues,
  defaultSalesPersonId,
  canPickSalesPerson = true,
  title,
  onSaved,
  overlayZIndex = 9999,
}) {
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);

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

  // This picker intentionally uses the general active-user dropdown. Customer
  // assignment is not restricted to the Sales Agent / Sales Manager role list.
  useEffect(() => {
    let active = true;

    setSalesPersonsLoading(true);
    userService.getUserDropDown({ isActive: true, PageNumber: 1, PageSize: 1000 })
      .then((users) => {
        if (!active) return;
        setSalesPersons(
          (Array.isArray(users) ? users : [])
            .map((user) => ({
              ...user,
              userId: Number(user?.userId ?? user?.UserId ?? user?.id ?? user?.Id) || 0,
              firstName: String(user?.firstName ?? user?.FirstName ?? '').trim(),
              lastName: String(user?.lastName ?? user?.LastName ?? '').trim(),
              userName: String(user?.userName ?? user?.UserName ?? user?.username ?? '').trim(),
              fullName:
                String(user?.fullName ?? user?.FullName ?? user?.name ?? user?.Name ?? '').trim()
                || [user?.firstName ?? user?.FirstName, user?.lastName ?? user?.LastName].filter(Boolean).join(' '),
            }))
            .filter((user) => user.userId > 0),
        );
      })
      .catch((error) => {
        console.error('Failed to load users for Sales Person:', error);
        if (active) setSalesPersons([]);
      })
      .finally(() => {
        if (active) setSalesPersonsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Resolve USA through the Country API, then use its real id for the
  // country-scoped State API. The UI and payload consistently use "USA" even
  // when an environment stores the matching country row as "america".
  useEffect(() => {
    let active = true;

    const loadLookups = async () => {
      try {
        const countriesResult = await countryService.getCountryDropdown();
        const countryRows = countriesResult.data || [];
        const usa = findUsaCountry(countryRows);
        const usaId = getCountryIdValue(usa);
        const stateRows = usaId
          ? await countryService.getStates({ CountryId: usaId, PageNumber: 1, PageSize: 1000, countryName: 'USA' })
          : [];

        if (!active) return;
        setCountries(countryRows);
        setStates(Array.isArray(stateRows) ? stateRows : []);
      } catch (error) {
        console.error('Failed to load customer lookups:', error);
      }
    };

    loadLookups();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const userId = Number(localStorage.getItem('userId') || 0);
    const userName = localStorage.getItem('userName') || '';

    const seed = { ...emptyForm, ...(initialValues || {}) };

    // Country is fixed to USA. Never let an empty initialValues blank it out.
    if (!String(seed.countryName || '').trim()) seed.countryName = 'USA';

    if (mode === 'add') {
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
    setFormErrors({});
    setShowValidationErrors(false);
    setLeadSearch('');
    setSalesPersonSearchText('');
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
  }, [open, countries, states]);

  // Editing a customer assigned to someone outside the sales roles must not
  // blank the field, so the stored sales person stays selectable.
  const salesPersonOptions = useMemo(() => {
    const list = salesPersons || [];
    const id = Number(formData.salesPerson) || 0;
    if (!id) return list;
    if (list.some((user) => Number(user?.userId) === id)) return list;

    const name = String(formData.salesPersonName || '').trim();
    return [{ userId: id, name: name || `User ${id}` }, ...list];
  }, [salesPersons, formData.salesPerson, formData.salesPersonName]);

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

  // Country is fixed to USA (read-only field). Resolve its real countryId from
  // the Country API: first from the already-loaded list, then via a targeted
  // search so the payload always carries USA's id even if it isn't on page 1.
  useEffect(() => {
    if (!open) return;
    if (Number(formData.countryId) > 0) return;

    let cancelled = false;

    const applyUsa = (usa) => {
      const usaId = getCountryIdValue(usa);
      if (!usaId) return false;
      setFormData((prev) =>
        Number(prev.countryId) > 0
          ? prev
          : { ...prev, countryId: usaId, countryName: 'USA' },
      );
      return true;
    };

    const resolveUsa = async () => {
      // 1) Try the list loaded on mount.
      const fromList = findUsaCountry(countries);
      if (fromList && applyUsa(fromList)) return;

      // 2) Fall back to fetching the Country dropdown API directly.
      try {
        const res = await countryService.getCountryDropdown();
        const list = res?.data || [];
        const usa = findUsaCountry(list) || list[0];
        if (usa && !cancelled) applyUsa(usa);
      } catch {
        // Leave countryId unresolved; the read-only USA field won't block Save.
      }
    };

    resolveUsa();
    return () => {
      cancelled = true;
    };
  }, [open, countries, formData.countryId]);

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
    if (q.length >= 3) setAddressPickerOpen(true);
    else {
      setAddressPickerOpen(false);
      setAddressResults([]);
    }
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
    setShowValidationErrors(true);
    const errors = validateCustomerForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      focusFirstError(errors);
      return;
    }

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

      const saved = mode === 'edit' ? await customerService.updateCustomer(payload) : await customerService.createCustomer(payload);
      toast.success(mode === 'edit' ? 'Customer updated' : 'Customer created');
      if (typeof onSaved === 'function') onSaved(saved);
      if (typeof onOpenChange === 'function') onOpenChange(false);
    } catch (error) {
      console.error('Failed to save customer:', error);
      // Fixed frontend message - the API's own error text is logged, not shown.
      toast.error(mode === 'edit' ? 'Failed to update customer' : 'Failed to create customer');
    }
  };

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
        if (e.target === e.currentTarget) onOpenChange?.(false);
      }}
    >
      <div
        data-modal-surface="true"
        className="customer-form-modal relative my-auto flex w-full max-w-4xl max-h-[calc(100dvh-2.5rem)] flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-[0_25px_70px_-15px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#141122] animate-in zoom-in-95 duration-200"
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
          <GlassCloseButton onClick={() => onOpenChange(false)} className="ml-4 shrink-0 !h-9 !w-9 !rounded-xl dark:!border-white/10 dark:!bg-white/5 dark:!text-slate-300" />
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/40 p-4 dark:bg-black/10 sm:p-6">
            {showValidationErrors && Object.keys(formErrors).length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">Please fix the highlighted fields.</div>
            )}

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Search Lead</label>
                <button
                  type="button"
                  onClick={rebuildLeadIndex}
                  disabled={leadsLoading || leadsRebuilding}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-xs transition-all',
                    (leadsLoading || leadsRebuilding) && 'opacity-60 cursor-not-allowed',
                  )}
                  title="Refresh leads"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', leadsRebuilding && 'animate-spin')} />
                  Refresh
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={leadPickerOpen}
                onClick={() => setLeadPickerOpen((current) => !current)}
                className={cn(
                  'customer-form-field h-11 w-full justify-between rounded-xl border-slate-200 bg-white px-3.5 shadow-sm shadow-slate-900/[0.02] hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-800',
                  !formData.leadId && 'text-muted-foreground',
                  showValidationErrors && formErrors.leadId && 'border-red-500 focus-visible:ring-red-500',
                )}
                data-field="leadId"
              >
                {(() => {
                  const selected = (leads || []).find((l) => Number(l.leadId) === Number(formData.leadId));
                  const selectedName = selected?.leadName || selected?.name || selected?.customerName || '';
                  return formData.leadId
                    ? `${formData.leadId}${selectedName ? ` - ${selectedName}` : ''}`
                    : 'Search and select a lead';
                })()}
                <ChevronsUpDown className={cn('ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform', leadPickerOpen && 'rotate-180')} />
              </Button>
              {leadPickerOpen && (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
                  <Command shouldFilter={false}>
                    <CommandInput
                      autoFocus
                      placeholder="Search by lead name, email, or phone..."
                      value={leadSearch}
                      onValueChange={setLeadSearch}
                    />
                    <CommandList className="max-h-52">
                      {leadSearch.trim().length < 2 ? (
                        <div className="px-4 py-5 text-center text-sm text-slate-500 dark:text-slate-400">
                          Enter at least 2 characters to search leads.
                        </div>
                      ) : leadsLoading ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Searching leads...
                        </div>
                      ) : (leads || []).length === 0 ? (
                        <div className="px-4 py-5 text-center text-sm text-slate-500 dark:text-slate-400">No leads found.</div>
                      ) : (
                        <CommandGroup>
                          {(leads || []).map((lead) => {
                            const leadId = Number(lead.leadId) || 0;
                            const leadName = lead.leadName || lead.name || lead.customerName || '';
                            const leadMeta = [lead.email, lead.phone].filter(Boolean).join(' • ');
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
                                className="rounded-lg px-3 py-2.5"
                              >
                                <Check className={cn('h-4 w-4', isSelected ? 'opacity-100 text-violet-600' : 'opacity-0')} />
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-slate-800 dark:text-slate-100">
                                    {leadName || `Lead #${leadId}`}
                                  </div>
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
              {showValidationErrors && formErrors.leadId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.leadId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Sales Person</label>
              <Select
                value={formData.salesPerson ? String(formData.salesPerson) : ''}
                onValueChange={handleSalesPersonChange}
                disabled={!canPickSalesPerson}
              >
                <SelectTrigger
                  className={cn(
                    'customer-form-field h-11 w-full rounded-xl border-slate-200 bg-white px-3.5 shadow-sm shadow-slate-900/[0.02] dark:border-slate-700 dark:bg-slate-800',
                    !canPickSalesPerson && 'disabled:opacity-100 disabled:cursor-not-allowed bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300',
                    showValidationErrors && formErrors.salesPerson && 'border-red-500 focus:ring-red-500',
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
                      placeholder="Search users by name, email, or role..."
                    />
                  )}
                >
                  {salesPersonsLoading ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading users...
                    </div>
                  ) : visibleSalesPersonOptions.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">No users found.</div>
                  ) : (
                    visibleSalesPersonOptions.map((user) => (
                      <SelectItem
                        key={user.userId}
                        value={String(user.userId)}
                        meta={<UserOptionBadges user={user} />}
                      >
                        {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.fullName || user.userName || `User ${user.userId}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {showValidationErrors && formErrors.salesPerson && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.salesPerson}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name *</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className={cn(
                  modalInputClass,
                  showValidationErrors && formErrors.name && 'border-red-500 focus:ring-red-500',
                )}
              />
              {showValidationErrors && formErrors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email *</label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className={cn(
                  modalInputClass,
                  showValidationErrors && formErrors.email && 'border-red-500 focus:ring-red-500',
                )}
              />
              {showValidationErrors && formErrors.email && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone *</label>
              <UsPhoneInput
                name="phone"
                ref={phoneInputRef}
                value={formData.phone}
                onChange={handleUsPhoneChange('phone')}
                required
                className={cn(
                  modalInputClass,
                  showValidationErrors && formErrors.phone && 'border-red-500 focus:ring-red-500',
                )}
              />
              {showValidationErrors && formErrors.phone && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone 2</label>
              <UsPhoneInput
                name="phone2"
                ref={phone2InputRef}
                value={formData.phone2}
                onChange={handleUsPhoneChange('phone2')}
                className={cn(
                  modalInputClass,
                  showValidationErrors && formErrors.phone2 && 'border-red-500 focus:ring-red-500',
                )}
              />
              {showValidationErrors && formErrors.phone2 && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.phone2}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Address</label>

              <Popover open={addressPickerOpen} onOpenChange={setAddressPickerOpen} modal={false}>
                <PopoverTrigger asChild>
                  <div className="w-full">
                    <div className="relative">
                      <input
                        name="address"
                        value={formData.address}
                        onChange={handleAddressChange}
                        onFocus={() => {
                          const q = String(addressSearch || formData.address || '').trim();
                          if (q.length >= 3) setAddressPickerOpen(true);
                        }}
                        className={cn(
                          `${modalInputClass} pr-10`,
                          showValidationErrors && formErrors.address && 'border-red-500 focus:ring-red-500',
                        )}
                        placeholder="Start typing address..."
                      />
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-300">
                        <Search className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                  style={{ zIndex: popupZ }}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <Command>
                    <CommandList>
                      <CommandEmpty>{addressLoading ? 'Searching...' : 'No addresses found.'}</CommandEmpty>
                      <CommandGroup>
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
                            >
                              <span className="text-xs leading-snug">{label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {showValidationErrors && formErrors.address && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.address}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Country *</label>
              <input
                value="USA"
                readOnly
                className={cn(
                  `${modalInputClass} cursor-not-allowed bg-slate-100 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300`,
                  showValidationErrors && formErrors.countryId && 'border-red-500',
                )}
                data-field="countryId"
              />
              {showValidationErrors && formErrors.countryId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.countryId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">State *</label>
              <Select
                value={formData.stateId ? String(formData.stateId) : ''}
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
                <SelectTrigger className={cn('customer-form-field h-11 w-full rounded-xl border-slate-200 bg-white px-3.5 shadow-sm shadow-slate-900/[0.02] dark:border-slate-700 dark:bg-slate-800', showValidationErrors && formErrors.stateId && 'border-red-500 focus:ring-red-500')} data-field="stateId">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent
                  className="max-h-72"
                  style={{ zIndex: popupZ }}
                  search={(
                    <SelectSearchInput
                      value={stateSearchText}
                      onChange={setStateSearchText}
                      placeholder="Search state..."
                    />
                  )}
                >
                  {visibleStateOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No states found.</div>
                  ) : (
                    visibleStateOptions.map((state) => (
                      <SelectItem key={state.stateId} value={String(state.stateId)}>
                        {state.stateName || state.name || `State ${state.stateId}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {showValidationErrors && formErrors.stateId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.stateId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">City *</label>
              <input
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                required
                className={cn(
                  modalInputClass,
                  showValidationErrors && formErrors.city && 'border-red-500 focus:ring-red-500',
                )}
              />
              {showValidationErrors && formErrors.city && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.city}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Zip Code *</label>
              <input
                name="zipCode"
                value={formData.zipCode}
                onChange={handleInputChange}
                required
                inputMode={zipKind === 'UK' ? 'text' : 'numeric'}
                pattern={zipKind === 'UK' ? '[A-Za-z0-9 ]*' : '\\d*'}
                maxLength={zipKind === 'UK' ? 10 : zipKind === 'US' ? 9 : zipKind === 'AU' ? 4 : 10}
                placeholder={zipKind === 'UK' ? 'SW1A 1AA' : zipKind === 'AU' ? '2000' : '12345'}
                className={cn(
                  modalInputClass,
                  showValidationErrors && formErrors.zipCode && 'border-red-500 focus:ring-red-500',
                )}
              />
              {showValidationErrors && formErrors.zipCode && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.zipCode}</p>}
            </div>

            {/* A brand new customer is always created Active, so the toggle only
                earns its place once there is a status to change. */}
            {mode === 'edit' && (
            <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Status
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  {formData.isActive ? 'Active' : 'Inactive'}
                </span>
                <IosToggle
                  checked={!!formData.isActive}
                  onCheckedChange={(nextChecked) =>
                    setFormData((prev) => ({ ...prev, isActive: !!nextChecked }))
                  }
                  title={formData.isActive ? 'Active' : 'Inactive'}
                />
              </div>
            </div>
            )}
          </div>

          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-slate-200/80 bg-slate-50/50 px-5 py-3.5 dark:border-white/10 dark:bg-[#141122] sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all shadow-xs"
            >
              Cancel
            </button>
            <LiquidGlassButton
              type="submit"
              className="!h-10 !rounded-xl px-6 text-center !text-sm !font-semibold shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
            >
              {mode === 'edit' ? 'Save Changes' : 'Create Customer'}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>
  , document.body);
}
