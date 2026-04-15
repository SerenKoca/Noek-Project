<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNoekState } from '../composables/useNoekState.js'

const router = useRouter()
const state = useNoekState()

onMounted(async () => {
  await state.bootstrap()
  if (state.authState.value?.token) {
    await router.replace('/home')
  }
})

async function submitAuth() {
  await state.onAuthSubmit()
  if (state.authState.value?.token) {
    await router.replace('/home')
  }
}
</script>

<template>
  <div class="editor-page is-home">
    <div class="auth-page-v2">
      <div class="auth-card-v2">
        <div class="auth-hero-v2">
          <div class="auth-logo-v2">NOEK</div>
          <h1>{{ state.authMode.value === 'register' ? 'Welkom bij jouw herinneringsruimte' : 'Welkom terug' }}</h1>
          <p>
            {{ state.authMode.value === 'register' ? 'Maak een account aan om een kamer te starten.' : 'Log in om je kamers en bijdragen te beheren.' }}
          </p>
        </div>

        <form class="auth-form-v2" @submit.prevent="submitAuth">
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
            <span>Naam</span>
            <input v-model="state.authDisplayName.value" type="text" placeholder="voor- en achternaam" autocomplete="nickname" />
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

          <div v-if="state.authStatus.value" class="auth-status-v2" :class="state.authStatusType.value">{{ state.authStatus.value }}</div>
        </form>
      </div>
    </div>
  </div>
</template>

<style src="./styles/auth-page.css"></style>
