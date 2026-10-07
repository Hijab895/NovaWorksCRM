const navByRole = {
  ADMIN: [
    { id: 'projects', label: 'Projects' },
    { id: 'create', label: 'Create from Transcript' },
    { id: 'team', label: 'Team' },
  ],
  MANAGER: [
    { id: 'projects', label: 'My Projects' },
    { id: 'team', label: 'Team' },
  ],
  AGENT: [
    { id: 'tasks', label: 'My Tasks' },
    { id: 'projects', label: 'Related Projects' },
    { id: 'team', label: 'Team' },
  ],
}

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function Layout({ user, page, onNavigate, onLogout, children }) {
  const navigation = navByRole[user.role] ?? []

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">NW</div>
          <div>
            <p className="brand-name">NovaWorks CRM</p>
            <p className="brand-subtitle">Operations workspace</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navigation.map((item) => (
            <button
              className={page === item.id ? 'nav-item active' : 'nav-item'}
              key={item.id}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="user-summary">
            <div className="avatar" aria-hidden="true">
              {initials(user.name)}
            </div>
            <div>
              <p className="user-name">{user.name}</p>
              <p className="user-meta">
                {user.role} · {user.specialization}
              </p>
            </div>
          </div>
          <button className="secondary-button" onClick={onLogout} type="button">
            Logout
          </button>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  )
}
