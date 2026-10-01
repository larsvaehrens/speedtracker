import { Icon } from "./Icon";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <a
        className="app-footer-link"
        href="https://github.com/larsvaehrens/speedtracker"
        rel="noopener noreferrer"
        target="_blank"
      >
        <Icon name="github" />
        GitHub
      </a>
    </footer>
  );
}
