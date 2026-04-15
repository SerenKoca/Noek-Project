import { createRouter, createWebHistory } from 'vue-router'
import { getStoredAuth } from '../services/authService.js'
import AuthPage from '../pages/AuthPage.vue'
import HomePage from '../pages/HomePage.vue'
import RoomSettingsPage from '../pages/RoomSettingsPage.vue'
import EditorPage from '../pages/EditorPage.vue'

function hasToken() {
  return Boolean(getStoredAuth()?.token)
}

function requireAuth(to, from, next) {
  if (!hasToken()) {
    next('/login')
    return
  }
  next()
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: () => (hasToken() ? '/home' : '/login')
    },
    {
      path: '/login',
      name: 'login',
      component: AuthPage
    },
    {
      path: '/home',
      name: 'home',
      component: HomePage,
      beforeEnter: requireAuth
    },
    {
      path: '/rooms/:id/settings',
      name: 'room-settings',
      component: RoomSettingsPage,
      beforeEnter: requireAuth
    },
    {
      path: '/rooms/:id/editor',
      name: 'room-editor',
      component: EditorPage,
      beforeEnter: requireAuth
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router
