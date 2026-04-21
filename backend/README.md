# Noek Backend API

Deze backend slaat Noek-kamers op in MongoDB.

## Installatie

1. Ga naar `backend`
2. `npm install`
3. Kopieer `.env.example` naar `.env`
4. Stel `MONGO_URI` in
5. Stel `JWT_SECRET` in
6. Start de server met `npm run dev`

## Eerste admin account seeden

1. Vul in `.env`:
  - `ADMIN_SEED_EMAIL`
  - `ADMIN_SEED_PASSWORD`
  - `ADMIN_SEED_DISPLAY_NAME` (optioneel)
2. Run: `npm run seed:admin`
3. Login met dit account via de normale loginflow.

Optioneel:
- Zet `ADMIN_SEED_RESET_PASSWORD=true` om een bestaand admin wachtwoord te resetten tijdens seeden.
- Gebruik `ADMIN_REGISTRATION_CODE` als je ook admin self-registration via `/auth` wil toestaan.

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
