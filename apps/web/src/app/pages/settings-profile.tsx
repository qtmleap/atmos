// /settings/profile — display name, handle, and avatar (docs/SPEC.md §5,
// designs/pages/settings-profile.html). Login-gated by useProfileForm (which
// wraps useCurrentUser).
import { LoadingRows } from '../components/common/loading-rows'
import { ProfileForm } from '../components/settings/profile-form'
import { SettingsShell, SettingsSignedOut } from '../components/settings/settings-shell'
import { useProfileForm } from '../hooks/use-profile-form'

export default function SettingsProfilePage() {
  const form = useProfileForm()

  if (form.loadingUser) {
    return <LoadingRows />
  }

  if (!form.loggedIn) {
    return <SettingsSignedOut />
  }

  return (
    <SettingsShell current="profile">
      <ProfileForm
        displayName={form.displayName}
        onDisplayNameChange={form.setDisplayName}
        handle={form.handle}
        onHandleChange={form.setHandle}
        saving={form.saving}
        saveError={form.saveError}
        saveSuccess={form.saveSuccess}
        onSave={() => void form.save()}
        onReset={form.reset}
        avatarUrl={form.avatarUrl}
        uploadingAvatar={form.uploadingAvatar}
        avatarError={form.avatarError}
        onAvatarFile={(file) => void form.uploadAvatar(file)}
      />
    </SettingsShell>
  )
}
