import { useMemo } from "react";

export function usePasswordStrength(password) {
    return useMemo(() => {
        let score = 0;

        const checks = {
            length8: password.length >= 8,
            length12: password.length >= 12,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password),
            symbol: /[^A-Za-z0-9]/.test(password),
        };

        if (checks.length8) score++;
        if (checks.lowercase && checks.uppercase) score++;
        if (checks.number) score++;
        if (checks.symbol) score++;

        let label = "Weak";
        let color = "#FF5C5C";

        if (score === 2) {
            label = "Fair";
            color = "#FF9800";
        }

        if (score === 3) {
            label = "Good";
            color = "#FFC107";
        }

        if (score === 4) {
            label = "Strong";
            color = "#22C55E";
        }

        return {
            score,
            label,
            color,
            checks,
            percentage: (score / 4) * 100,
        };
    }, [password]);
}