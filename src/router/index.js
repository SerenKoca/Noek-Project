import { createRouter, createWebHistory } from 'vue-router'
import { getStoredAuth } from '../services/authService.js'
import AuthPage from '../pages/AuthPage.vue'
import HomePage from '../pages/HomePage.vue'
import RoomSettingsPage from '../pages/RoomSettingsPage.vue'
import EditorPage from '../pages/EditorPage.vue'

const APP_TITLE = 'Noek'

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
      component: AuthPage,
      meta: { title: 'Inloggen' }
    },
    {
      path: '/home',
      name: 'home',
      component: HomePage,
      beforeEnter: requireAuth,
      meta: { title: 'Home' }
    },
    {
      path: '/rooms/:id/settings',
      name: 'room-settings',
      component: RoomSettingsPage,
      beforeEnter: requireAuth,
      meta: { title: 'Kamer instellingen' }
    },
    {
      path: '/rooms/:id/editor',
      name: 'room-editor',
      component: EditorPage,
      beforeEnter: requireAuth,
      meta: { title: 'Kamer editor' }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

router.afterEach((to) => {
  const routeTitle = typeof to.meta?.title === 'string' ? to.meta.title.trim() : ''
  document.title = routeTitle ? `${routeTitle} | ${APP_TITLE}` : APP_TITLE
})

export default router
