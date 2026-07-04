import { useLocalSearchParams } from "expo-router";
import ProfileView from "../../components/ProfileView";

export default function PublicProfileScreen() {
  const { username, uid } = useLocalSearchParams();

  return (
    <ProfileView
      isOwnProfile={false}
      targetUsername={typeof username === "string" ? username : null}
      targetUid={typeof uid === "string" ? uid : null}
    />
  );
}
