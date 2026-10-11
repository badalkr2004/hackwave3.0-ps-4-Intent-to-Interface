import { fixtureSpec } from '../gallery/fixtures';
import { IntentCommand } from '../shell/IntentCommand';
import { WhyToggle } from '../shell/WhyToggle';
import { Workbench } from './Workbench';

/** Auth-free route to verify shell + workbench render. */
export function WorkbenchPreview() {
  const spec = fixtureSpec('overview');
  return (
    <div className="app-atmosphere min-h-screen px-6 py-6">
      <header className="mb-5 flex items-center justify-between border-b border-border pb-4">
        <p className="font-display text-2xl text-text">Gestalt preview</p>
        <WhyToggle on={false} onToggle={() => {}} />
      </header>
      <IntentCommand
        busy={false}
        demoPrompts={['Prepare me for the Acme meeting tomorrow']}
        onSubmit={() => {}}
        onHome={() => {}}
      />
      <div className="mt-6">
        <Workbench spec={spec} onRunAction={() => {}} onPrompt={() => {}} />
      </div>
    </div>
  );
}
