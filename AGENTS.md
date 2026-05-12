# Simplification Mandate

> *Simple code is code where a small change in requirements requires a small change in code, and a new developer can understand the relevant part without understanding the whole system.*

These rules apply to all code produced or modified in this session.

## 1. Prefer Depth Over Breadth

- **Deep modules win.** A module with a simple interface and rich implementation is better than many shallow wrappers.
- **Fight classitis.** Do not create a new file, class, or module unless it provides a significant, distinct abstraction. Merging is usually better than splitting.
- **Every abstraction must pull its weight.** A pass-through method, a thin adapter, or a config parameter with a single caller is an abstraction that costs more than it saves. Inline it or eliminate it.

## 2. Information Hiding Is the Primary Design Tool

- **Hide implementation details.** The interface should expose what, not how. If changing an internal data structure requires touching callers, the abstraction is broken.
- **Do not leak knowledge across module boundaries.** If the same format, protocol, or ordering assumption appears in multiple modules, it is leaked information. Re-home it into a single owner.
- **Code that changes together belongs together.** If a small feature requires touching 5+ unrelated files, the decomposition is wrong.

## 3. Pull Complexity Downward

- **A module should take on complexity so its callers don't have to.** A complex interface with a simple implementation is inverted. Fix it.
- **Infer sensible defaults.** Do not push configuration decisions to callers unless the caller genuinely knows better.
- **Design errors and special cases out of existence.** Return empty collections instead of null. Make illegal states unrepresentable. Every exception you add is a tax on every caller.

## 4. Split With Caution

- **Do not split a function just because it is long.** A 50-line function with one clear narrative is better than five 10-line functions with a tangled call graph.
- **Do not create a new module just to DRY up 3 lines of trivial code.** Duplication is cheaper than the wrong abstraction.
- **Split only when it creates a cleaner abstraction or eliminates real duplication.** The new interface must be simpler than what it replaces.

## 5. Names Are the UI of Your Code

- **Names must be precise and intention-revealing.** If a reader must read the implementation to know what a function does, the name is wrong.
- **One word per concept.** Pick a term and use it consistently everywhere.
- **Avoid `Manager`, `Processor`, `Data`, `Info` in class names.** They signal unclear purpose.

## 6. Kill Dead Code and Obvious Waste

- **Delete unused code immediately.** Source control has the history. Dead code is a liability, not an asset.
- **Delete commented-out code.** It is not documentation.
- **Eliminate pass-through methods and thin wrappers.** If a method's body is a single call to another method with the same signature, it should not exist.

## 7. Navigate Shallowly

- **Law of Demeter.** Do not write `a.getB().getC().doThing()`. Give the intermediate object a method that does what the caller needs.
- **No deep object graphs.** If a caller must traverse three levels to get work done, the layers are not pulling their weight.

## 8. Comments Describe What the Code Cannot Say

- **Interface comments are mandatory.** Document the abstraction — what the module does, not how. Without this, there is no abstraction.
- **Do not write comments that repeat the code.** They rot and lie.
- **Comments capture the designer's intent.** Why this approach? What are the invariants? What would break if you changed X?

## 9. Preserve Behavior While Simplifying

- **Simplification must not change external behavior.**
- **Tests must pass before and after.** If there are no tests for the code you are simplifying, write them first.
- **Refactor in small steps.** Do not rewrite 500 lines in one go.

## 10. The Obviousness Test

- **Code should be obvious to a reader without diagrams or deep study.** If you need to draw a box-and-arrow diagram to explain the module structure, it is too complex.
- **When in doubt, merge.** When still in doubt, keep it together. It is easier to split later than to undo premature fragmentation.

