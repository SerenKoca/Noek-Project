# Noek Backend API

Deze backend slaat Noek-kamers op in MongoDB.

## Installatie

1. Ga naar `backend`
2. `npm install`
3. Kopieer `.env.example` naar `.env`
4. Stel `MONGO_URI` in
5. Stel `JWT_SECRET` in
6. Start de server met `npm run dev`

## API endpoints

- `POST /auth` - login/register
  - body register: `{ action: "register", email, password, displayName? }`
  - body login: `{ action: "login", email, password }`
  - response: `{ token, user }`

- `POST /rooms` - kamer opslaan
  - body: `{ name, sceneData, userId? }`
- `GET /rooms` - alle kamers ophalen
- `GET /rooms/:id` - één kamer ophalen
- `DELETE /rooms/:id` - kamer verwijderen

Alle `/rooms` endpoints vereisen `Authorization: Bearer <token>`.

## Voorbeeld frontend-aanroep

```js
const response = await fetch('http://localhost:5000/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Mijn kamer',
    sceneData: { /* object met kamerdata */ }
  })
});
const room = await response.json();
```
