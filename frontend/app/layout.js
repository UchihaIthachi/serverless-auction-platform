import React from 'react';
import UserProvider from '@/components/UserProvider';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter'; // or `v14-appRouter` if you are using Next.js 14
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/lib/theme'; // Assuming a theme file will be created

export const metadata = {
  title: 'Next.js Auction App',
  description: 'A simple auction app built with Next.js and Material UI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <UserProvider>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <body>{children}</body>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </UserProvider>
    </html>
  );
}
