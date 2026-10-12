"use client";

import { Component, Fragment, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  resetKey: number;
}

/**
 * Captura excepciones lanzadas durante el render (p. ej. `useQuery` de Convex
 * cuando la query falla) y deja reintentar sin recargar toda la página:
 * `reset()` limpia el estado de error y cambia la `key` de `children`, forzando
 * que se vuelvan a montar (y por tanto a relanzar la query que falló) en vez de
 * solo re-renderizar el árbol que ya había lanzado.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  reset = () => {
    this.setState((prev) => ({ hasError: false, resetKey: prev.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.reset);
    }
    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}
