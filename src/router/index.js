import { createRouter, createWebHistory } from 'vue-router'
import { getStoredAuth } from '../services/authService.js'
import AuthPage from '../pages/AuthPage.vue'
import HomePage from '../pages/HomePage.vue'
import RoomSettingsPage from '../pages/RoomSettingsPage.vue'
import EditorPage from '../pages/EditorPage.vue'
import ProfilePage from '../pages/ProfilePage.vue'
import VisitorRoomPage from '../pages/VisitorRoomPage.vue'

const APP_TITLE = 'Noek'

function hasToken() {
  return Boolean(getStoredAuth()?.token)
}

function isEditor() {
  return getStoredAuth()?.user?.role === 'editor'
}

function requireAuth(to, from, next) {
  if (!hasToken()) {
    next('/login')
    return
  }
  next()
}

function requireEditor(to, from, next) {
  if (!hasToken()) {
    next('/login')
    return
  }

  if (!isEditor()) {
    next('/profile')
    return
  }

  next()
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: () => (hasToken() ? (isEditor() ? '/home' : '/profile') : '/login')
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
      beforeEnter: requireEditor,
      meta: { title: 'Home' }
    },
    {
      path: '/rooms/:id/settings',
      name: 'room-settings',
      component: RoomSettingsPage,
      beforeEnter: requireEditor,
      meta: { title: 'Kamer instellingen' }
    },
    {
      path: '/rooms/:id/editor',
      name: 'room-editor',
      component: EditorPage,
      beforeEnter: requireEditor,
      meta: { title: 'Kamer editor' }
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfilePage,
      beforeEnter: requireAuth,
      meta: { title: 'Profiel' }
    },
    {
      path: '/visit/:id',
      name: 'visitor-room',
      component: VisitorRoomPage,
      meta: { title: 'Bezoek kamer' }
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
