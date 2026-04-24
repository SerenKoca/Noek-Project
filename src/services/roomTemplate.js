export const ROOM_TEMPLATE = {
  slots: [
    {
      id: 'slot-sofa',
      label: 'Zitmeubel',
      accepts: ['meubel'],
      position: [-6.2, 0, -12.4],
      rotationY: Math.PI * 0.97,
      initialModel: {
        id: 'ZOPP3KzNIk',
        title: 'Couch Small',
        url: 'https://static.poly.pizza/4e8fbbf3-9992-4068-8918-2126a0304127.glb',
        scaleMultiplier: 0.72,
        rotationYOffset: 0.08
      }
    },
    {
      id: 'slot-table',
      label: 'Tafel',
      accepts: ['meubel', 'decoratie', 'persoonlijk'],
      position: [-1.9, 0, -9.9],
      rotationY: Math.PI * 0.95,
      initialModel: {
        id: 'rAEBvfb1FT',
        title: 'Small Table',
        url: 'https://static.poly.pizza/0f319f3b-b0d6-4691-bae5-c6c6e612df99.glb',
        scaleMultiplier: 0.62,
        rotationYOffset: 0.05
      }
    },
    {
      id: 'slot-tv',
      label: 'Media meubel',
      accepts: ['meubel'],
      position: [5.8, 0, -12.8],
      rotationY: Math.PI,
      initialModel: {
        id: '9trLeWoBek',
        title: 'Television',
        url: 'https://static.poly.pizza/1ddcd36c-ac9e-4dc2-a056-846cea033c02.glb',
        scaleMultiplier: 0.84,
        rotationYOffset: 0
      }
    },
    {
      id: 'slot-shelf',
      label: 'Kast',
      accepts: ['meubel', 'persoonlijk', 'decoratie'],
      position: [9.2, 0, -8.2],
      rotationY: Math.PI * 1.44,
      initialModel: {
        id: 'tACDGJ4CGW',
        title: 'Bookcase with Books',
        url: 'https://static.poly.pizza/7d59d0aa-6447-4bbb-afc7-0452e9a34353.glb',
        scaleMultiplier: 0.68,
        rotationYOffset: -0.08
      }
    }
  ]
}
