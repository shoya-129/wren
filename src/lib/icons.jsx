import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Bell,
  Check,
  Clock,
  Compass,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Home,
  Image,
  ImageIcon,
  Key,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  MoreVertical,
  Plus,
  Repeat2,
  Search,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRound,
  UserRoundKey,
  Users,
  UserX,
  X,
} from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import colors from "./colors.json";

// Individual components forwarding all props (color, fill, strokeWidth, size, style, etc.)
export const ArrowLeftIcon = (props) => <ArrowLeft {...props} />;
export const BadgeCheckIcon = (props) => <BadgeCheck {...props} />;
const hexToRgba = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
};

export const VerifiedIcon = ({ size = 24, style, strokeWidth = 2, ...props }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={style}
    {...props}
  >
    {/* Badge Background with 18% opacity primary color and primary color stroke */}
    <Path
      d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      fill={hexToRgba(colors.primary, 0.25)}
      stroke={colors.primary}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Tick / Checkmark in primary color */}
    <Path
      d="m9 12 2 2 4-4"
      stroke={colors.primary}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);
export const BellIcon = (props) => <Bell {...props} />;
export const CompassIcon = (props) => <Compass {...props} />;
export const HomeIcon = (props) => <Home {...props} />;
export const SearchIcon = (props) => <Search {...props} />;
export const UserRoundIcon = (props) => <UserRound {...props} />;
export const UserRoundKeyIcon = (props) => <UserRoundKey {...props} />;
export const UserIcon = (props) => <User {...props} />;
export const UserPlusIcon = (props) => <UserPlus {...props} />;
export const UserCheckIcon = (props) => <UserCheck {...props} />;
export const UserMinusIcon = (props) => <UserMinus {...props} />;
export const UserXIcon = (props) => <UserX {...props} />;
export const LockIcon = (props) => <Lock {...props} />;
export const KeyIcon = (props) => <Key {...props} />;
export const SendIcon = (props) => <Send {...props} />;
export const ShieldAlertIcon = (props) => <ShieldAlert {...props} />;
export const ShieldCheckIcon = (props) => <ShieldCheck {...props} />;
export const XIcon = (props) => <X {...props} />;
export const FileTextIcon = (props) => <FileText {...props} />;
export const ImageIconIcon = (props) => <ImageIcon {...props} />;
export const ImageLucideIcon = (props) => <Image {...props} />;
export const CheckIcon = (props) => <Check {...props} />;
export const MailIcon = (props) => <Mail {...props} />;
export const ClockIcon = (props) => <Clock {...props} />;
export const AlertTriangleIcon = (props) => <AlertTriangle {...props} />;
export const FlagIcon = (props) => <Flag {...props} />;
export const Trash2Icon = (props) => <Trash2 {...props} />;
export const MessageCircleIcon = (props) => <MessageCircle {...props} />;
export const MoreVerticalIcon = (props) => <MoreVertical {...props} />;
export const Repeat2Icon = (props) => <Repeat2 {...props} />;
export const Share2Icon = (props) => <Share2 {...props} />;
export const ThumbsDownIcon = (props) => <ThumbsDown {...props} />;
export const ThumbsUpIcon = (props) => <ThumbsUp {...props} />;
export const UsersIcon = (props) => <Users {...props} />;
export const LogOutIcon = (props) => <LogOut {...props} />;
export const EyeIcon = (props) => <Eye {...props} />;
export const EyeOffIcon = (props) => <EyeOff {...props} />;
export const PlusIcon = (props) => <Plus {...props} />;

// Namespace object to allow WrenIcons.IconName usage
export const WrenIcons = {
  ArrowLeft: ArrowLeftIcon,
  BadgeCheck: BadgeCheckIcon,
  Verified: VerifiedIcon,
  Bell: BellIcon,
  Compass: CompassIcon,
  Home: HomeIcon,
  Search: SearchIcon,
  UserRound: UserRoundIcon,
  UserRoundKey: UserRoundKeyIcon,
  User: UserIcon,
  UserPlus: UserPlusIcon,
  UserCheck: UserCheckIcon,
  UserMinus: UserMinusIcon,
  UserX: UserXIcon,
  Lock: LockIcon,
  Key: KeyIcon,
  Send: SendIcon,
  ShieldAlert: ShieldAlertIcon,
  ShieldCheck: ShieldCheckIcon,
  X: XIcon,
  FileText: FileTextIcon,
  ImageIcon: ImageIconIcon,
  Image: ImageLucideIcon,
  Check: CheckIcon,
  Mail: MailIcon,
  Clock: ClockIcon,
  AlertTriangle: AlertTriangleIcon,
  Flag: FlagIcon,
  Trash2: Trash2Icon,
  MessageCircle: MessageCircleIcon,
  MoreVertical: MoreVerticalIcon,
  Repeat2: Repeat2Icon,
  Share2: Share2Icon,
  ThumbsDown: ThumbsDownIcon,
  ThumbsUp: ThumbsUpIcon,
  Users: UsersIcon,
  LogOut: LogOutIcon,
  Eye: EyeIcon,
  EyeOff: EyeOffIcon,
  Plus: PlusIcon,
};

export default WrenIcons;
