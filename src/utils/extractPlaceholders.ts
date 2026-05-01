import PizZip from "pizzip";
import { logger } from "./logger";

export const extractPlaceholdersFromDocx = (buffer: Buffer): string[] => {
  try {
    const zip = new PizZip(buffer);

    // Read document.xml which contains the main content
    const documentXml = zip.file("word/document.xml")?.asText();

    if (!documentXml) {
      logger.error("Could not read document.xml from .docx file");
      return [];
    }

    // Try multiple delimiter patterns
    const patterns = [
      /«([^»]+)»/g, // French quotes: «PLACEHOLDER»
      /<<([^>]+)>>/g, // Double angle brackets: <<PLACEHOLDER>>
      /\{\{([^}]+)\}\}/g, // Double curly braces: {{PLACEHOLDER}}
      /\$\{([^}]+)\}/g, // Dollar braces: ${PLACEHOLDER}
      /%([A-Z_0-9]+)%/g // Percent signs: %PLACEHOLDER%
    ];

    const allPlaceholders: Set<string> = new Set();

    for (const pattern of patterns) {
      const matches = documentXml.matchAll(pattern);
      for (const match of matches) {
        const placeholder = match[1].trim();
        if (placeholder) {
          allPlaceholders.add(placeholder);
        }
      }
    }

    const placeholders = Array.from(allPlaceholders);

    if (placeholders.length === 0) {
      logger.warn("No placeholders found in template. Checked patterns: «...», <<...>>, {{...}}, ${...}, %...%");
      logger.info("Document XML preview:", documentXml.substring(0, 500));
    } else {
      logger.info(`Extracted ${placeholders.length} placeholders from template:`, placeholders);
    }

    return placeholders;
  } catch (error) {
    logger.error("Failed to extract placeholders from template:", error);
    return [];
  }
};
