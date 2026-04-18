import { SettingsForm } from './settings-form'

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl w-full">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm />
    </div>
  )
}
