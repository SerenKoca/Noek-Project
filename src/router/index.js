import { createRouter, createWebHistory } from 'vue-router'
import { getStoredAuth } from '../services/authService.js'
import AuthPage from '../pages/AuthPage.vue'
import HomePage from '../pages/HomePage.vue'
import RoomSettingsPage from '../pages/RoomSettingsPage.vue'
import EditorPage from '../pages/EditorPage.vue'
import ProfilePage from '../pages/ProfilePage.vue'
import VisitorRoomPage from '../pages/VisitorRoomPage.vue'
import AdminPage from '../pages/AdminPage.vue'
import DirectorPage from '../pages/DirectorPage.vue'
import { startGlobalLoading, endGlobalLoading } from '../services/globalLoading.js'

const APP_TITLE = 'Noek'

function hasToken() {
  return Boolean(getStoredAuth()?.token)
}

function isEditor() {
  return getStoredAuth()?.user?.role === 'editor'
}

function getCurrentRole() {
  return getStoredAuth()?.user?.role || 'visitor'
}

function getDefaultRouteForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'funeral_director') return '/director'
  if (role === 'editor') return '/home'
  return '/profile'
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

function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles]

  return (to, from, next) => {
    if (!hasToken()) {
      next('/login')
      return
    }

    const role = getCurrentRole()
    if (!allowedRoles.includes(role)) {
      next(getDefaultRouteForRole(role))
      return
    }

    next()
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: () => (hasToken() ? getDefaultRouteForRole(getCurrentRole()) : '/login')
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
      path: '/rooms/create',
      name: 'create-room',
      component: () => import('../pages/CreateRoomPage.vue'),
      beforeEnter: requireEditor,
      meta: { title: 'Nieuwe kamer' }
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
      path: '/admin',
      name: 'admin',
      component: AdminPage,
      beforeEnter: requireRole('admin'),
      meta: { title: 'Admin' }
    },
    {
      path: '/director',
      name: 'director',
      component: DirectorPage,
      beforeEnter: requireRole('funeral_director'),
      meta: { title: 'Uitvaartondernemer' }
    },
    {
      path: '/visit/:id/:category?',
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

let navigationToken = null

router.beforeEach((to, from, next) => {
  endGlobalLoading(navigationToken)
  navigationToken = startGlobalLoading()
  next()
})

router.afterEach((to) => {
  endGlobalLoading(navigationToken)
  navigationToken = null
  const routeTitle = typeof to.meta?.title === 'string' ? to.meta.title.trim() : ''
  document.title = routeTitle ? `${routeTitle} | ${APP_TITLE}` : APP_TITLE
})

router.onError(() => {
  endGlobalLoading(navigationToken)
  navigationToken = null
})

export default router
