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
    shopTab: string
    signInTab: string
    notificationsTab: string
    followersTab: string
    profile: {
      title: string
      description: string
      photo: string
      photoHint: string
      changePhoto: string
      removePhoto: string
      removingPhoto: string
      uploading: string
      banner: string
      bannerHint: string
      changeBanner: string
      removeBanner: string
      removingBanner: string
      bannerDefaultHint: string
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
      username: string
      seeMyStore: string
      saved: string
      sellerBannerTitle: string
      save: string
      saving: string
    }
    personalInfo: {
      title: string
      description: string
      privateBadge: string
      firstName: string
      lastName: string
      phone: string
      phoneDisclosure: string
      save: string
      update: string
      saving: string
      saved: string
    }
    language: {
      title: string
      description: string
      label: string
    }
    account: {
      title: string
      description: string
      loginMethods: string
      signedInWithGoogle: string
      signedInWithEmail: string
      emailVerification: string
      verified: string
      changeEmailTitle: string
      newEmail: string
      updateEmail: string
      resetPassword: string
      resetPasswordDescription: string
      resetPasswordButton: string
      resetPasswordSending: string
      resetPasswordToastSuccess: string
      resetPasswordToastNoEmail: string
      changePassword: string
      changePasswordDescription: string
      changePasswordUnavailable: string
      changePasswordExpand: string
      changePasswordCollapse: string
      changePasswordCurrent: string
      changePasswordNew: string
      changePasswordConfirm: string
      changePasswordButton: string
      changePasswordSaving: string
      changePasswordSuccess: string
      changePasswordWrongCurrent: string
      changePasswordTooShort: string
      changePasswordMismatch: string
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
      line1: string
      line2: string
      city: string
      state: string
      postal: string
      country: string
      label: string
      addTitle: string
      editTitle: string
      shippingOnlyHint: string
    }
    notifications: {
      intro: string
      messagesTitle: string
    }
  }
}

const en: Translations = {
  settings: {
    title: 'Profile',
    subtitle: 'Manage your account and public profile',
    profileTab: 'Profile',
    shopTab: 'Shop',
    signInTab: 'Sign-in',
    notificationsTab: 'Notifications',
    followersTab: 'Followers',
    profile: {
      title: 'Profile Information',
      description: 'Update your public profile details',
      photo: 'Profile Photo',
      photoHint: 'Click the avatar to upload.',
      changePhoto: 'Change photo',
      removePhoto: 'Remove photo',
      removingPhoto: 'Removing...',
      uploading: 'Uploading...',
      banner: 'Profile banner',
      bannerHint: 'Wide image shown at the top of your public seller profile.',
      changeBanner: 'Upload banner',
      removeBanner: 'Remove banner',
      removingBanner: 'Removing...',
      bannerDefaultHint: 'Uses the default Reswell blue when no banner is uploaded.',
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
      bioPlaceholder: 'Say something about yourself',
      username: 'My username',
      seeMyStore: 'See my store',
      saved: 'Saved',
      sellerBannerTitle: 'Shop banner',
      save: 'Save',
      saving: 'Saving...',
    },
    personalInfo: {
      title: 'Personal information',
      description:
        'Private account details used for shipping labels, checkout, and text alerts. Never shown on your public profile.',
      privateBadge: 'Private',
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Mobile number',
      phoneDisclosure:
        'Used on prepaid shipping labels. Phone is required for carrier delivery issues. By providing your phone number, you agree that Reswell and its shipping partners may send automated text messages related to your orders, shipments, labels, delivery issues, and account support. Message and data rates may apply. Reply STOP to opt out.',
      save: 'Save personal information',
      update: 'Update personal information',
      saving: 'Saving...',
      saved: 'Saved',
    },
    language: {
      title: 'Language',
      description: 'Choose the language for the site.',
      label: 'Site language',
    },
    account: {
      title: 'Account',
      description: 'Manage your account settings',
      loginMethods: 'Login methods',
      signedInWithGoogle: 'You signed in with Google',
      signedInWithEmail: 'You signed in with email',
      emailVerification: 'Email verification status',
      verified: 'Verified',
      changeEmailTitle: 'Change email address',
      newEmail: 'New email address',
      updateEmail: 'Update email',
      resetPassword: 'Reset password',
      resetPasswordDescription:
        "We'll email you a secure link to choose a new password for this account.",
      resetPasswordButton: 'Email reset link',
      resetPasswordSending: 'Sending…',
      resetPasswordToastSuccess:
        'Check your email for a link to reset your password. You can close this tab after you finish.',
      resetPasswordToastNoEmail:
        'This account does not have an email on file. Change your password via the provider you signed up with.',
      changePassword: 'Change password',
      changePasswordDescription:
        'Enter your current password and choose a new one — no email link required.',
      changePasswordUnavailable:
        'You sign in with Google or another provider on this account. Use “Email reset link” below if you want to add or reset an email-and-password login.',
      changePasswordExpand: 'Enter new password',
      changePasswordCollapse: 'Close',
      changePasswordCurrent: 'Current password',
      changePasswordNew: 'New password',
      changePasswordConfirm: 'Confirm new password',
      changePasswordButton: 'Save new password',
      changePasswordSaving: 'Saving…',
      changePasswordSuccess: 'Your password was updated.',
      changePasswordWrongCurrent: 'Current password is incorrect.',
      changePasswordTooShort: 'Password must be at least 6 characters.',
      changePasswordMismatch: 'New passwords do not match.',
      signOut: 'Sign Out',
      signOutDescription: 'Sign out of your account on this device',
    },
    addresses: {
      tab: 'Addresses',
      title: 'Shipping addresses',
      description:
        'Where packages ship. Your name and phone are saved in Personal information above.',
      add: 'Add address',
      empty: 'No shipping addresses yet. Add one to speed up checkout.',
      defaultBadge: 'Default',
      setDefault: 'Set as default',
      edit: 'Edit',
      delete: 'Delete',
      deleteTitle: 'Delete this address?',
      deleteDescription: 'This cannot be undone. Checkout will ask for a new address if needed.',
      save: 'Save address',
      cancel: 'Cancel',
      line1: 'Street address',
      line2: 'Apt, suite, etc. (optional)',
      city: 'City',
      state: 'State',
      postal: 'ZIP code',
      country: 'Country',
      label: 'Nickname (optional)',
      addTitle: 'Add shipping address',
      editTitle: 'Edit shipping address',
      shippingOnlyHint:
        'Shipping location only — update your legal name and phone in Personal information above.',
    },
    notifications: {
      intro: 'Choose which notifications you want. These apply to your account on the web and in the app.',
      messagesTitle: 'Messages',
    },
  },
}

const es: Translations = {
  settings: {
    title: 'Perfil',
    subtitle: 'Administra tu cuenta y perfil público',
    profileTab: 'Perfil',
    shopTab: 'Tienda',
    signInTab: 'Inicio de sesión',
    notificationsTab: 'Notificaciones',
    followersTab: 'Seguidores',
    profile: {
      title: 'Información del perfil',
      description: 'Actualiza los detalles de tu perfil público',
      photo: 'Foto de perfil',
      photoHint: 'Haz clic en el avatar para subir.',
      changePhoto: 'Cambiar foto',
      removePhoto: 'Quitar foto',
      removingPhoto: 'Quitando...',
      uploading: 'Subiendo...',
      banner: 'Banner del perfil',
      bannerHint: 'Imagen ancha en la parte superior de tu perfil público de vendedor.',
      changeBanner: 'Subir banner',
      removeBanner: 'Quitar banner',
      removingBanner: 'Quitando...',
      bannerDefaultHint: 'Se usa el azul predeterminado de Reswell si no subes un banner.',
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
      bioPlaceholder: 'Cuéntales algo sobre ti',
      username: 'Mi nombre de usuario',
      seeMyStore: 'Ver mi tienda',
      saved: 'Guardado',
      sellerBannerTitle: 'Banner de la tienda',
      save: 'Guardar',
      saving: 'Guardando...',
    },
    personalInfo: {
      title: 'Información personal',
      description:
        'Datos privados de la cuenta para etiquetas de envío, checkout y alertas por SMS. No se muestran en tu perfil público.',
      privateBadge: 'Privado',
      firstName: 'Nombre',
      lastName: 'Apellido',
      phone: 'Teléfono móvil',
      phoneDisclosure:
        'Se usa en etiquetas de envío prepagadas. El teléfono es necesario para incidencias de entrega. Al proporcionar tu número, aceptas que Reswell y sus socios de envío puedan enviarte mensajes automatizados sobre pedidos, envíos, etiquetas, incidencias de entrega y soporte de cuenta. Pueden aplicarse tarifas de mensajes y datos. Responde STOP para cancelar.',
      save: 'Guardar información personal',
      update: 'Actualizar información personal',
      saving: 'Guardando...',
      saved: 'Guardado',
    },
    language: {
      title: 'Idioma',
      description: 'Elige el idioma del sitio.',
      label: 'Idioma del sitio',
    },
    account: {
      title: 'Cuenta',
      description: 'Administra la configuración de tu cuenta',
      loginMethods: 'Métodos de inicio de sesión',
      signedInWithGoogle: 'Iniciaste sesión con Google',
      signedInWithEmail: 'Iniciaste sesión con correo',
      emailVerification: 'Estado de verificación del correo',
      verified: 'Verificado',
      changeEmailTitle: 'Cambiar correo electrónico',
      newEmail: 'Nuevo correo electrónico',
      updateEmail: 'Actualizar correo',
      resetPassword: 'Restablecer contraseña',
      resetPasswordDescription:
        'Te enviaremos un enlace seguro por correo para elegir una nueva contraseña.',
      resetPasswordButton: 'Enviar enlace',
      resetPasswordSending: 'Enviando…',
      resetPasswordToastSuccess:
        'Revisa tu correo para el enlace de restablecimiento. Puedes cerrar esta pestaña cuando termines.',
      resetPasswordToastNoEmail:
        'Esta cuenta no tiene correo. Cambia tu contraseña desde el método con el que te registraste.',
      changePassword: 'Cambiar contraseña',
      changePasswordDescription:
        'Introduce tu contraseña actual y elige una nueva — sin enlace por correo.',
      changePasswordUnavailable:
        'En esta cuenta inicias sesión con Google u otro proveedor. Usa “Enviar enlace” abajo si quieres añadir o restablecer acceso con correo y contraseña.',
      changePasswordExpand: 'Introducir nueva contraseña',
      changePasswordCollapse: 'Cerrar',
      changePasswordCurrent: 'Contraseña actual',
      changePasswordNew: 'Nueva contraseña',
      changePasswordConfirm: 'Confirmar contraseña',
      changePasswordButton: 'Guardar contraseña',
      changePasswordSaving: 'Guardando…',
      changePasswordSuccess: 'Tu contraseña se actualizó.',
      changePasswordWrongCurrent: 'La contraseña actual no es correcta.',
      changePasswordTooShort: 'La contraseña debe tener al menos 6 caracteres.',
      changePasswordMismatch: 'Las contraseñas nuevas no coinciden.',
      signOut: 'Cerrar sesión',
      signOutDescription: 'Cerrar sesión en este dispositivo',
    },
    addresses: {
      tab: 'Direcciones',
      title: 'Direcciones de envío',
      description:
        'Dónde se envían los paquetes. Tu nombre y teléfono están en Información personal arriba.',
      add: 'Añadir dirección',
      empty: 'Aún no hay direcciones de envío. Añade una para agilizar el checkout.',
      defaultBadge: 'Predeterminada',
      setDefault: 'Usar como predeterminada',
      edit: 'Editar',
      delete: 'Eliminar',
      deleteTitle: '¿Eliminar esta dirección?',
      deleteDescription: 'No se puede deshacer. El checkout pedirá una nueva dirección si hace falta.',
      save: 'Guardar dirección',
      cancel: 'Cancelar',
      line1: 'Calle y número',
      line2: 'Depto, suite, etc. (opcional)',
      city: 'Ciudad',
      state: 'Estado',
      postal: 'Código postal',
      country: 'País',
      label: 'Apodo (opcional)',
      addTitle: 'Añadir dirección de envío',
      editTitle: 'Editar dirección de envío',
      shippingOnlyHint:
        'Solo ubicación de envío — actualiza tu nombre legal y teléfono en Información personal arriba.',
    },
    notifications: {
      intro: 'Elige qué notificaciones quieres. Se aplican a tu cuenta en la web y en la app.',
      messagesTitle: 'Mensajes',
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
