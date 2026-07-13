# PublicProfilePage

A reusable React profile page extracted from the supplied mockup. It uses regular CSS, so Tailwind is not required.

## Local preview

From this repository, run `npm install`, `npm run build:profile`, and `npm start`, then open:

```text
http://localhost:4173/profile-preview.html
```

Install the two runtime dependencies in a React or Next.js project:

```bash
npm install react lucide-react
```

Import it:

```jsx
import { PublicProfilePage, samplePublicProfile } from "./components";

export default function ProfileRoute() {
  return (
    <PublicProfilePage
      profile={samplePublicProfile}
      isOwner
      onProfileUpdate={(profile) => saveProfileToApi(profile)}
      onFollowChange={(following) => console.log({ following })}
      onMessage={(profile) => console.log("Message", profile.name)}
      onPostLike={(post, liked) => console.log(post.id, liked)}
    />
  );
}
```

Replace any field in `samplePublicProfile` with API data. `onFollowChange`, `onMessage`, `onTabChange`, `onPostLike`, and `onPostSave` are optional integration hooks.

Set `isOwner` when the signed-in user owns the profile. This replaces public Follow/Message actions with Edit profile/Manage posts controls. `onProfileUpdate(nextProfile)` is called after saving so the host application can persist changes to its API or database; without it, edits remain local to the mounted component.
