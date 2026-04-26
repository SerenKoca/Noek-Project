export const ROOM_TEMPLATE = {
  slots: [
    {
      id: 'slot-sofa',
      label: 'Zetel',
      accepts: ['meubel'],
      position: [-6.8, 0, -12.2],
      rotationY: Math.PI * 0.97,
      initialModel: {
        id: 'ZOPP3KzNIk',
        title: 'Couch Small',
        url: 'https://static.poly.pizza/4e8fbbf3-9992-4068-8918-2126a0304127.glb',
        scaleMultiplier: 1.22,
        rotationYOffset: 0.08
      }
    },
    {
      id: 'slot-armchair-right',
      label: 'Zetel',
      accepts: ['meubel'],
      position: [-2.3, 0, -14.8],
      rotationY: Math.PI * 1.14,
      initialModel: {
        id: 'myd1WSucAz',
        title: 'Armchair',
        url: 'https://static.poly.pizza/2584a961-1b06-4fb7-ba7d-1074b52ca908.glb',
        scaleMultiplier: 1.05,
        rotationYOffset: -0.05
      }
    },
    {
      id: 'slot-table',
      label: 'Tafel',
      accepts: ['meubel', 'decoratie', 'persoonlijk'],
      position: [-2.2, 0, -9.2],
      rotationY: Math.PI * 0.95,
      initialModel: {
        id: 'rAEBvfb1FT',
        title: 'Small Table',
        url: 'https://static.poly.pizza/0f319f3b-b0d6-4691-bae5-c6c6e612df99.glb',
        scaleMultiplier: 1.08,
        rotationYOffset: 0.05
      }
    },
    {
      id: 'slot-candle-side',
      label: 'Decoratie klein',
      accepts: ['decoratie', 'persoonlijk'],
      position: [-4.9, 1.15, -7.9],
      rotationY: Math.PI * 0.1,
      initialModel: {
        id: 'tknOVwxT8B',
        title: 'Candlestick',
        url: 'https://static.poly.pizza/e6c65b91-0e3a-45f6-8e9e-9da5faa3f91d.glb',
        scaleMultiplier: 0.46,
        rotationYOffset: 0
      }
    },
    {
      id: 'slot-tv',
      label: 'Media',
      accepts: ['meubel'],
      position: [6.2, 0, -12.6],
      rotationY: Math.PI,
      initialModel: {
        id: '9trLeWoBek',
        title: 'Television',
        url: 'https://static.poly.pizza/1ddcd36c-ac9e-4dc2-a056-846cea033c02.glb',
        scaleMultiplier: 1.06,
        rotationYOffset: 0
      }
    },
    {
      id: 'slot-shelf',
      label: 'Kast',
      accepts: ['meubel', 'persoonlijk', 'decoratie'],
      position: [9.3, 0, -8.1],
      rotationY: Math.PI * 1.44,
      initialModel: {
        id: 'tACDGJ4CGW',
        title: 'Bookcase with Books',
        url: 'https://static.poly.pizza/7d59d0aa-6447-4bbb-afc7-0452e9a34353.glb',
        scaleMultiplier: 1.14,
        rotationYOffset: -0.08
      }
    },
    {
      id: 'slot-hat-stand',
      label: 'Lamp',
      accepts: ['meubel', 'decoratie'],
      position: [11.8, 0, -12.9],
      rotationY: Math.PI * 1.55,
      initialModel: {
        id: 'IWnizIOIyu',
        title: 'Hat Stand',
        url: 'https://static.poly.pizza/f9aa955b-0515-4d32-8b27-0e48062b7c34.glb',
        scaleMultiplier: 1.18,
        rotationYOffset: 0
      }
    }
  ]
}
