import type { SessionUser } from "../lib/session";

interface UserMenuProps {
  user: SessionUser;
  chipClassName: string;
  avatarClassName: string;
  nameClassName?: string;
}

function initials(user: SessionUser): string {
  const source = user.name ?? user.email ?? "?";
  return source.trim().charAt(0).toUpperCase();
}

export default function UserMenu({
  user,
  chipClassName,
  avatarClassName,
  nameClassName,
}: UserMenuProps) {
  return (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className={chipClassName} title="Sign out">
        <span className={avatarClassName}>{initials(user)}</span>
        <span className={nameClassName}>{user.name ?? user.email ?? "Account"}</span>
      </button>
    </form>
  );
}
