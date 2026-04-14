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
    profileTab: string
    followersTab: string
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
    addresses: {
      tab: string
      title: string
      description: string
      add: string
      empty: string
      defaultBadge: string
      setDefault: string
      edit: string
      delete: string
      deleteTitle: string
      deleteDescription: string
      save: string
      cancel: string
      fullName: string
      phone: string
      line1: string
      line2: string
      city: string
      state: string
      postal: string
      country: string
      label: string
      addTitle: string
      editTitle: string
    }
  }
}

const en: Translations = {
  settings: {
    title: 'Profile',
    subtitle: 'Manage your account and public profile',
    profileTab: 'Profile',
    followersTab: 'Followers',
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
    addresses: {
      tab: 'Addresses',
      title: 'Saved addresses',
      description: 'Use these at checkout for shipping. You can add several and mark one as default.',
      add: 'Add address',
      empty: 'No saved addresses yet. Add one to speed up checkout.',
      defaultBadge: 'Default',
      setDefault: 'Set as default',
      edit: 'Edit',
      delete: 'Delete',
      deleteTitle: 'Delete this address?',
      deleteDescription: 'This cannot be undone. Checkout will ask for a new address if needed.',
      save: 'Save address',
      cancel: 'Cancel',
      fullName: 'Full name',
      phone: 'Phone',
      line1: 'Address line 1',
      line2: 'Address line 2 (optional)',
      city: 'City',
      state: 'State / region',
      postal: 'Postal code',
      country: 'Country',
      label: 'Label (optional)',
      addTitle: 'Add address',
      editTitle: 'Edit address',
    },
  },
}

const es: Translations = {
  settings: {
    title: 'Perfil',
    subtitle: 'Administra tu cuenta y perfil público',
    profileTab: 'Perfil',
    followersTab: 'Seguidores',
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
    addresses: {
      tab: 'Direcciones',
      title: 'Direcciones guardadas',
      description:
        'Úsalas en el checkout para envíos. Puedes añadir varias y marcar una como predeterminada.',
      add: 'Añadir dirección',
      empty: 'Aún no hay direcciones. Añade una para agilizar el checkout.',
      defaultBadge: 'Predeterminada',
      setDefault: 'Usar como predeterminada',
      edit: 'Editar',
      delete: 'Eliminar',
      deleteTitle: '¿Eliminar esta dirección?',
      deleteDescription: 'No se puede deshacer. El checkout pedirá una nueva dirección si hace falta.',
      save: 'Guardar dirección',
      cancel: 'Cancelar',
      fullName: 'Nombre completo',
      phone: 'Teléfono',
      line1: 'Línea de dirección 1',
      line2: 'Línea de dirección 2 (opcional)',
      city: 'Ciudad',
      state: 'Estado / región',
      postal: 'Código postal',
      country: 'País',
      label: 'Etiqueta (opcional)',
      addTitle: 'Añadir dirección',
      editTitle: 'Editar dirección',
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
