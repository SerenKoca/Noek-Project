<script setup>
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'
import './styles/auth-page.css'

const router = useRouter()
const route = useRoute()
const state = useNoekState()

const isEditorRole = computed(() => state.authRegisterRole.value === 'editor')

const authTitle = computed(() => {
  if (state.authMode.value !== 'register') return 'Welkom terug'
  return isEditorRole.value ? 'Editor account aanmaken' : 'Bezoekersaccount aanmaken'
})

const authSubtitle = computed(() => {
  if (state.authMode.value !== 'register') return 'Log in om aan de reis te beginnen'
  return isEditorRole.value
    ? 'Gebruik je registratiecode om een kamer te creëren en herinneringen te delen'
    : 'Met een account zal je samen gemakkelijker herinneringen kunnen delen en bewaren.'
})

function getRouteByRole(role) {
  // If a `next` query param exists (e.g. coming from a room), use it for visitors
  if (role === 'visitor' && route.query?.next) return String(route.query.next)
  if (role === 'admin') return '/admin'
  if (role === 'funeral_director') return '/director'
  if (role === 'editor') return '/home'
  return '/profile'
}

onMounted(async () => {
  await state.bootstrap()
  if (state.authState.value?.token) {
    const next = getRouteByRole(state.authState.value?.user?.role)
    await router.replace(next)
  }
})

async function submitAuth() {
  await state.onAuthSubmit()
  if (state.authState.value?.token) {
    const next = getRouteByRole(state.authState.value?.user?.role)
    await router.replace(next)
  }
}
</script>

<template>
  <div class="editor-page is-home">
    <div class="auth-page-v2">
      <div class="auth-card-v2">
        <div class="auth-hero-v2">
          <div class="auth-logo-v2">
            <img src="/img/logo-noek.svg" alt="Noek logo" class="auth-logo-image-v2" />
          </div>
          <h1>{{ authTitle }}</h1>
          <p>{{ authSubtitle }}</p>
          <div class="auth-candle-scene-v2" aria-hidden="true">
            <div class="auth-candle-v2 is-large">
              <span class="auth-candle-flame-v2"></span>
              <span class="auth-candle-wax-v2"></span>
            </div>
            <div class="auth-candle-v2 is-small">
              <span class="auth-candle-flame-v2"></span>
              <span class="auth-candle-wax-v2"></span>
            </div>
          </div>
        </div>

        <form class="auth-form-v2" @submit.prevent="submitAuth">

          <label v-if="state.authMode.value === 'register'" class="auth-field-v2">
            <span>Naam</span>
            <input v-model="state.authDisplayName.value" type="text" placeholder="voor- en achternaam" autocomplete="nickname" />
          </label>

          <label class="auth-field-v2">
            <span>Email</span>
            <input v-model="state.authEmail.value" type="email" placeholder="voer je email in" autocomplete="email" />
          </label>

          <label class="auth-field-v2">
            <span>Wachtwoord</span>
            <input
              v-model="state.authPassword.value"
              type="password"
              :placeholder="state.authMode.value === 'register' ? 'min. 8 karakters' : 'voer je wachtwoord in'"
              autocomplete="current-password"
            />
          </label>



          <label v-if="state.authMode.value === 'register'" class="auth-field-v2">
            <span>Accounttype</span>
            <select v-model="state.authRegisterRole.value">
              <option value="editor">Editor</option>
              <option value="visitor">Bezoeker</option>
            </select>
          </label>

          <label v-if="state.authMode.value === 'register' && isEditorRole" class="auth-field-v2">
            <span>Registratiecode</span>
            <input
              v-model="state.authRegistrationCode.value"
              type="text"
              placeholder="voer je code in"
              autocomplete="off"
            />
          </label>

          <button type="submit" class="auth-submit-v2">
            {{ state.authMode.value === 'register' ? 'Registreren' : 'Inloggen' }}
          </button>

          <button
            type="button"
            class="auth-switch-v2"
            @click="state.authMode.value = state.authMode.value === 'register' ? 'login' : 'register'"
          >
            {{ state.authMode.value === 'register' ? 'Ik heb al een account' : 'Nog geen account? Registreren' }}
          </button>

          <!-- <p v-if="state.authMode.value === 'login'" class="auth-info-inline">
            Login mogelijk voor: Uitvaartondernemers,  en bezoeker.
          </p> -->

          <div v-if="state.authStatus.value" class="auth-status-v2" :class="state.authStatusType.value">{{ state.authStatus.value }}</div>
        </form>
      </div>
    </div>
  </div>
</template>
