'use client';
import React from 'react';
import { UserProvider as Auth0UserProvider } from '@auth0/nextjs-auth0/client';

export default function UserProvider({ children }) {
  return <Auth0UserProvider>{children}</Auth0UserProvider>;
}
