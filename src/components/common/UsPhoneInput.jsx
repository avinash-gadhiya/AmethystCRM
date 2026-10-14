import React, { useCallback, useLayoutEffect, useRef } from 'react';
import {
  US_PHONE_MAX_LENGTH,
  US_PHONE_PLACEHOLDER,
  formatUsPhone,
  isForeignPhoneEntry,
  normalizeDigits,
  stripUsCountryCode,
} from '@/lib/usPhone';

// Where the caret belongs once the value is re-formatted: at the Nth digit,
// counting past whatever punctuation the mask put in the way.
const caretPosForDigitIndex = (formatted, digitIndex) => {
  const text = String(formatted || '');
  const target = Math.max(0, Number(digitIndex) || 0);
  if (!text) return 0;

  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text[i])) {
      if (seen >= target) return i;
      seen += 1;
    }
  }
  return text.length;
};

/**
 * The single phone input used everywhere in the CRM.
 *
 * It masks to US format as the user types - 6265265165 becomes
 * (626) 526-5165 - while staying editable, which is the part a naive mask gets
 * wrong: backspacing over the ")", the space or the "-" would be a no-op,
 * because the mask puts the character straight back and the value never
 * changes. Here a deleted separator removes the digit the user was reaching
 * for, and the caret lands on it.
 *
 * A clearly foreign entry (+44..., more than 11 digits) is passed through
 * unmasked so validation can reject it. Masking it would strip the country
 * code and keep the first 10 digits, quietly turning it into a US-shaped
 * number that every check accepts.
 *
 * `onChange` receives the next string value, not the event.
 */
const UsPhoneInput = React.forwardRef(function UsPhoneInput(
  {
    value,
    onChange,
    onKeyDown,
    className,
    placeholder = US_PHONE_PLACEHOLDER,
    maxLength = US_PHONE_MAX_LENGTH,
    ...props
  },
  forwardedRef,
) {
  const innerRef = useRef(null);
  const caretRef = useRef(null);
  const deleteKeyRef = useRef('');

  const setRefs = useCallback(
    (el) => {
      innerRef.current = el;
      if (typeof forwardedRef === 'function') forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    [forwardedRef],
  );

  // Re-formatting moves every character after the edit, so the caret has to be
  // put back by hand once the parent has re-rendered with the new value.
  useLayoutEffect(() => {
    const el = innerRef.current;
    const desired = caretRef.current;
    caretRef.current = null;

    if (!el || desired == null) return;
    if (typeof document !== 'undefined' && document.activeElement !== el) return;

    try {
      el.setSelectionRange(desired, desired);
    } catch {
      // Some browsers reject setSelectionRange on certain input types.
    }
  });

  const handleKeyDown = (event) => {
    // onChange alone can't tell a Backspace from a Delete, and the two remove
    // opposite sides of a separator.
    deleteKeyRef.current =
      event.key === 'Backspace' || event.key === 'Delete' ? event.key : '';
    if (typeof onKeyDown === 'function') onKeyDown(event);
  };

  const handleChange = (event) => {
    const el = event.target;
    const raw = String(el.value || '');
    const previous = String(value || '');
    const caret = typeof el.selectionStart === 'number' ? el.selectionStart : raw.length;

    const deleteKey = deleteKeyRef.current;
    deleteKeyRef.current = '';

    if (isForeignPhoneEntry(raw)) {
      caretRef.current = caret;
      if (typeof onChange === 'function') onChange(raw);
      return;
    }

    let digits = stripUsCountryCode(normalizeDigits(raw)).slice(0, 10);
    let digitsBeforeCaret = normalizeDigits(raw.slice(0, caret)).length;

    // A one-character deletion that took a separator rather than a digit: the
    // user aimed at the digit on the other side of it.
    const removedChar = previous.length - raw.length === 1 ? previous[caret] : '';
    const removedSeparator = Boolean(removedChar) && !/\d/.test(removedChar);

    if (removedSeparator && deleteKey === 'Backspace' && digitsBeforeCaret > 0) {
      digits = digits.slice(0, digitsBeforeCaret - 1) + digits.slice(digitsBeforeCaret);
      digitsBeforeCaret -= 1;
    } else if (removedSeparator && deleteKey === 'Delete') {
      digits = digits.slice(0, digitsBeforeCaret) + digits.slice(digitsBeforeCaret + 1);
    }

    const formatted = formatUsPhone(digits);
    caretRef.current = caretPosForDigitIndex(formatted, Math.min(digitsBeforeCaret, digits.length));

    if (typeof onChange === 'function') onChange(formatted);
  };

  return (
    <input
      {...props}
      ref={setRefs}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={placeholder}
      maxLength={maxLength}
      value={value || ''}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      className={className}
    />
  );
});

export default UsPhoneInput;


