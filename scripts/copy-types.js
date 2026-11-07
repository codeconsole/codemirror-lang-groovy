// Publish the hand-written type declarations next to both bundles.
import {copyFileSync} from "fs"

for (let target of ["dist/index.d.ts", "dist/index.d.cts"]) copyFileSync("src/index.d.ts", target)
