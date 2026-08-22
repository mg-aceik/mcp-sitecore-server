import { describe, it, expect } from "vitest";
import {
    decodeClixmlWhitespace,
    findErrorRecord,
    formatPowershellError,
    isParameterBindingError,
    wantsFullErrors,
    xmlLooksLikeError,
} from "../../src/tools/powershell/error-shaping";

// Trimmed from a real response captured against an XM Cloud CM:
// `Get-Item -Path 'master:/sitecore/content' -Bogus 1` (9,269 characters in full).
const namedParameterNotFound = {
    ToString: "A parameter cannot be found that matches parameter name 'Bogus'.",
    writeErrorStream: true,
    Exception: {
        Message: "A parameter cannot be found that matches parameter name 'Bogus'.",
        StackTrace: "at System.Management.Automation.CmdletParameterBinderController...",
    },
    InvocationInfo: {
        MyCommand: {
            Name: "Get-Item",
            Definition: "a very long definition",
            ParameterSets: [
                "[-Path] <string[]> [-Filter <string>] [<CommonParameters>]",
                "-LiteralPath <string[]> [-Filter <string>] [<CommonParameters>]",
            ],
        },
        ScriptLineNumber: 1,
        OffsetInLine: 41,
    },
    FullyQualifiedErrorId: "NamedParameterNotFound,Microsoft.PowerShell.Commands.GetItemCommand",
    ErrorCategory_Reason: "ParameterBindingException",
    ErrorCategory_Message: "InvalidArgument: (:) [Get-Item], ParameterBindingException",
};

const writeErrorGuard = {
    ToString: "No matching rendering was found.",
    writeErrorStream: true,
    Exception: { Message: "No matching rendering was found." },
    InvocationInfo: { ScriptLineNumber: 3, OffsetInLine: 12 },
    FullyQualifiedErrorId: "Microsoft.PowerShell.Commands.WriteErrorException",
    ErrorCategory_Reason: "WriteErrorException",
    ErrorCategory_Message: "NotSpecified: (:) [Write-Error], WriteErrorException",
};

describe("findErrorRecord", () => {
    it("finds the error record", () => {
        expect(findErrorRecord({ Obj: [namedParameterNotFound] })).toBe(namedParameterNotFound);
    });

    it("finds an error emitted after successful output, not just at Obj[0]", () => {
        expect(findErrorRecord({ Obj: [{ Name: "Home" }, namedParameterNotFound] }))
            .toBe(namedParameterNotFound);
    });

    it("returns undefined for a successful response", () => {
        expect(findErrorRecord({ Obj: [{ Name: "Error 404", ItemPath: "/sitecore/content/Error 404" }] }))
            .toBeUndefined();
        expect(findErrorRecord({})).toBeUndefined();
        expect(findErrorRecord({ Obj: 9768 })).toBeUndefined();
    });
});

describe("isParameterBindingError", () => {
    it("recognises a binding failure", () => {
        expect(isParameterBindingError(namedParameterNotFound)).toBe(true);
    });

    it("does not treat a Write-Error guard as a binding failure", () => {
        expect(isParameterBindingError(writeErrorGuard)).toBe(false);
    });
});

describe("formatPowershellError", () => {
    const shaped = formatPowershellError(namedParameterNotFound);

    it("names the cmdlet and the offending parameter", () => {
        expect(shaped).toContain("Get-Item failed:");
        expect(shaped).toContain("parameter name 'Bogus'");
    });

    it("includes the error id and the position", () => {
        expect(shaped).toContain("FullyQualifiedErrorId: NamedParameterNotFound");
        expect(shaped).toContain("At line 1, char 41.");
    });

    it("lists the valid parameter sets without the useless CommonParameters suffix", () => {
        expect(shaped).toContain("-LiteralPath <string[]> [-Filter <string>]");
        expect(shaped).not.toContain("CommonParameters");
    });

    it("drops the stack trace, the cmdlet definition and the rest of the record", () => {
        expect(shaped).not.toContain("StackTrace");
        expect(shaped).not.toContain("a very long definition");
    });

    it("stays small enough to be worth reading", () => {
        expect(shaped.length).toBeLessThan(500);
    });

    it("omits parameter sets for a failure where they would not help", () => {
        const guard = formatPowershellError(writeErrorGuard);
        expect(guard).toContain("No matching rendering was found.");
        expect(guard).not.toContain("Valid parameter sets");
    });

    it("falls back gracefully when the record carries no message", () => {
        expect(formatPowershellError({ writeErrorStream: true }))
            .toContain("PowerShell reported an error with no message.");
    });
});

describe("decodeClixmlWhitespace", () => {
    it("turns the encoded control characters back into line breaks", () => {
        expect(decodeClixmlWhitespace("a_x000D__x000A_b_x000D_c_x000A_d")).toBe("a\nbc\nd");
    });
});

describe("wantsFullErrors", () => {
    it("honours the per-call flag", () => {
        expect(wantsFullErrors(true, {})).toBe(true);
        expect(wantsFullErrors(undefined, {})).toBe(false);
    });

    it("honours the global env var", () => {
        expect(wantsFullErrors(undefined, { POWERSHELL_FULL_ERRORS: "true" })).toBe(true);
        expect(wantsFullErrors(undefined, { POWERSHELL_FULL_ERRORS: "false" })).toBe(false);
    });
});

describe("xmlLooksLikeError", () => {
    it("detects a CLIXML error stream entry and a serialized error record", () => {
        expect(xmlLooksLikeError('<Objs><S S="Error">boom</S></Objs>')).toBe(true);
        expect(xmlLooksLikeError('<Objs><Obj><S N="ErrorCategory_Message">x</S></Obj></Objs>')).toBe(true);
    });

    it("does not flag content that merely mentions the word Error", () => {
        // The old check was `text.includes("Error")`, so a site's own "Error 404" page
        // item was enough to report the tool call as failed.
        expect(xmlLooksLikeError('<Objs><S N="Name">Error 404</S></Objs>')).toBe(false);
    });
});
