const option =
  "card flex cursor-pointer items-center gap-2 p-3 font-mono text-sm has-[:checked]:shadow-[3px_3px_0_var(--accent)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";

export function RolePicker() {
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="label">I am a</legend>
      <label className={option}>
        <input type="radio" name="role" value="LISTENER" defaultChecked className="accent-[var(--accent)]" /> listener
      </label>
      <label className={option}>
        <input type="radio" name="role" value="ARTIST" className="accent-[var(--accent)]" /> artist
      </label>
    </fieldset>
  );
}
