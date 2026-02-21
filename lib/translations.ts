export const LOCALE_COOKIE_NAME = 'locale'
export const DEFAULT_LOCALE = 'en' as const

export type Locale = 'en' | 'es'

export const SUPPORTED_LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]

type Translations = {
  settings: {
    title: string
    subtitle: string
    profile: {
      title: string
      description: string
      photo: string
      photoHint: string
      changePhoto: string
      uploading: string
      email: string
      emailHint: string
      displayName: string
      displayNamePlaceholder: string
      displayNameHint: string
      location: string
      locationPlaceholder: string
      city: string
      cityPlaceholder: string
      bio: string
      bioPlaceholder: string
      save: string
      saving: string
    }
    language: {
      title: string
      description: string
      label: string
    }
    account: {
      title: string
      description: string
      signOut: string
      signOutDescription: string
    }
  }
}

const en: Translations = {
  settings: {
    title: 'Settings',
    subtitle: 'Manage your account and public profile',
    profile: {
      title: 'Profile Information',
      description: 'Update your public profile details',
      photo: 'Profile Photo',
      photoHint: 'Click the avatar to upload. JPG, PNG, or WebP. Max 2MB.',
      changePhoto: 'Change photo',
      uploading: 'Uploading...',
      email: 'Email',
      emailHint: 'Your email cannot be changed',
      displayName: 'Display Name',
      displayNamePlaceholder: 'Your display name',
      displayNameHint: 'No profanity or email addresses. Shown to other users.',
      location: 'Location',
      locationPlaceholder: 'e.g., California',
      city: 'City',
      cityPlaceholder: 'e.g., San Diego',
      bio: 'Bio',
      bioPlaceholder: 'Tell other surfers about yourself...',
      save: 'Save Changes',
      saving: 'Saving...',
    },
    language: {
      title: 'Language',
      description: 'Choose the language for the site.',
      label: 'Site language',
    },
    account: {
      title: 'Account',
      description: 'Manage your account settings',
      signOut: 'Sign Out',
      signOutDescription: 'Sign out of your account on this device',
    },
  },
}

const es: Translations = {
  settings: {
    title: 'Ajustes',
    subtitle: 'Administra tu cuenta y perfil público',
    profile: {
      title: 'Información del perfil',
      description: 'Actualiza los detalles de tu perfil público',
      photo: 'Foto de perfil',
      photoHint: 'Haz clic en el avatar para subir. JPG, PNG o WebP. Máx. 2MB.',
      changePhoto: 'Cambiar foto',
      uploading: 'Subiendo...',
      email: 'Correo electrónico',
      emailHint: 'Tu correo no se puede cambiar',
      displayName: 'Nombre público',
      displayNamePlaceholder: 'Tu nombre público',
      displayNameHint: 'Sin groserías ni correos. Visible para otros usuarios.',
      location: 'Ubicación',
      locationPlaceholder: 'ej., California',
      city: 'Ciudad',
      cityPlaceholder: 'ej., San Diego',
      bio: 'Biografía',
      bioPlaceholder: 'Cuéntales a otros surfistas sobre ti...',
      save: 'Guardar cambios',
      saving: 'Guardando...',
    },
    language: {
      title: 'Idioma',
      description: 'Elige el idioma del sitio.',
      label: 'Idioma del sitio',
    },
    account: {
      title: 'Cuenta',
      description: 'Administra la configuración de tu cuenta',
      signOut: 'Cerrar sesión',
      signOutDescription: 'Cerrar sesión en este dispositivo',
    },
  },
}

export const translations: Record<Locale, Translations> = { en, es }

export function getT(locale: Locale) {
  const dict = translations[locale] ?? translations.en
  return function t<K extends keyof Translations>(key: K): Translations[K] {
    return dict[key]
  }
}
