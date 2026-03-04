import { Component, ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-500 mb-4">Please refresh the page to continue.</p>
          <button onClick={() => window.location.reload()}
            className="bg-[#00477f] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#003a6b]">
            Refresh Page
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}
