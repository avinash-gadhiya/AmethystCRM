import { KeyRound, Link2, Plus, RefreshCw, Save, Server } from 'lucide-react';
import AppModal from '@/components/common/AppModal';
import { GATEWAY_TYPES } from '../gatewayUtils';
import { GatewayButton, GatewayInput, GatewaySelect, GatewayToggle } from './GatewayUI';

const bindField = (form, setForm, key) => ({
  value: form[key] ?? '',
  onChange: (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
});

export default function GatewayEditors({ gateway, mapping, sync, gatewayOptions, saving, error }) {
  const options = gatewayOptions.map((item) => ({ value: item.gatewayId, label: item.gatewayName }));
  const footer = (close, text, Icon = Save) => (
    <>
      <GatewayButton onClick={close} disabled={saving}>
        Cancel
      </GatewayButton>
      <GatewayButton
        type="submit"
        variant="primary"
        disabled={saving}
        icon={saving ? RefreshCw : Icon}
        className={saving ? 'gateway-button--busy' : ''}
      >
        {saving ? 'Please wait...' : text}
      </GatewayButton>
    </>
  );
  const errorMessage = error && (
    <div role="alert" className="gateway-form-error">
      {error}
    </div>
  );

  return (
    <>
      <AppModal
        open={gateway.open}
        onClose={gateway.close}
        onSubmit={gateway.save}
        busy={saving}
        size="lg"
        className="gateway-dialog"
        icon={Server}
        title={gateway.form.gatewayId ? 'Edit gateway' : 'Add gateway'}
        footer={footer(gateway.close, 'Save gateway')}
      >
        {errorMessage}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GatewayInput label="Gateway name" required {...bindField(gateway.form, gateway.setForm, 'gatewayName')} />
          <GatewayInput label="Brand ID" required type="number" min="1" {...bindField(gateway.form, gateway.setForm, 'brandId')} />
          <GatewaySelect
            label="Gateway type"
            value={gateway.form.gatewayType}
            onChange={(value) => gateway.setForm((current) => ({ ...current, gatewayType: value }))}
            options={GATEWAY_TYPES}
          />
          <GatewayInput
            label="API base URL"
            type="url"
            placeholder="https://"
            {...bindField(gateway.form, gateway.setForm, 'apiBaseUrl')}
          />
        </div>
        <fieldset className="gateway-credential-panel mt-6">
          <legend className="flex items-center gap-2 px-1 text-xs font-semibold">
            <KeyRound size={14} />
            Credentials
          </legend>
          {gateway.form.hasCredentials && (
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Leave login and secret blank to keep existing credentials.</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GatewayInput label="API login ID" autoComplete="off" {...bindField(gateway.form, gateway.setForm, 'apiLoginId')} />
            <GatewayInput
              label="API secret key"
              type="password"
              autoComplete="new-password"
              {...bindField(gateway.form, gateway.setForm, 'apiSecretKey')}
            />
            <GatewayInput
              label="Merchant site ID"
              className="sm:col-span-2"
              {...bindField(gateway.form, gateway.setForm, 'merchantSiteId')}
            />
          </div>
        </fieldset>
        <div className="mt-5 flex flex-wrap gap-6">
          <GatewayToggle
            label="Active"
            checked={gateway.form.isActive}
            onChange={(event) => gateway.setForm((current) => ({ ...current, isActive: event.target.checked }))}
          />
          <GatewayToggle
            label="Sandbox"
            checked={gateway.form.isSandbox}
            onChange={(event) => gateway.setForm((current) => ({ ...current, isSandbox: event.target.checked }))}
          />
        </div>
      </AppModal>

      <AppModal
        open={mapping.open}
        onClose={mapping.close}
        onSubmit={mapping.save}
        busy={saving}
        className="gateway-dialog"
        icon={Link2}
        title={mapping.form.gatewayPaymentTypeId ? 'Edit payment mapping' : 'Add payment mapping'}
        footer={footer(mapping.close, 'Save mapping', Plus)}
      >
        {errorMessage}
        <div className="space-y-4">
          <GatewaySelect
            label="Gateway"
            value={mapping.form.gatewayId}
            onChange={(value) => mapping.setForm((current) => ({ ...current, gatewayId: value }))}
            options={[{ value: '', label: 'Select gateway' }, ...options]}
          />
          <GatewayInput
            label="Payment type IDs"
            required
            placeholder="1, 2, 3"
            {...bindField(mapping.form, mapping.setForm, 'paymentTypeIds')}
          />
          <p className="!mt-1.5 text-xs text-slate-500 dark:text-slate-400">Separate multiple IDs with commas.</p>
          <GatewayInput label="Payment type name" {...bindField(mapping.form, mapping.setForm, 'paymentTypeName')} />
          <GatewayToggle
            label="Active"
            checked={mapping.form.isActive}
            onChange={(event) => mapping.setForm((current) => ({ ...current, isActive: event.target.checked }))}
          />
        </div>
      </AppModal>

      <AppModal
        open={sync.open}
        onClose={sync.close}
        onSubmit={sync.save}
        busy={saving}
        className="gateway-dialog"
        icon={RefreshCw}
        title="Sync transactions"
        footer={footer(sync.close, 'Start sync', RefreshCw)}
      >
        {errorMessage}
        <div className="space-y-4">
          <GatewayInput label="Brand ID" required type="number" min="1" {...bindField(sync.form, sync.setForm, 'brandId')} />
          <GatewayInput label="Gateway IDs" placeholder="All gateways" {...bindField(sync.form, sync.setForm, 'gatewayIds')} />
          <p className="!mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Leave blank for all gateways, or enter IDs separated by commas.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GatewayInput
              label="From date"
              type="date"
              max={sync.form.toDate || undefined}
              {...bindField(sync.form, sync.setForm, 'fromDate')}
            />
            <GatewayInput
              label="To date"
              type="date"
              min={sync.form.fromDate || undefined}
              {...bindField(sync.form, sync.setForm, 'toDate')}
            />
          </div>
        </div>
      </AppModal>
    </>
  );
}
