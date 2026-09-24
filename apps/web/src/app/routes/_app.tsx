// Pathless layout: every page except the component catalog renders inside
// AppLayout (the ruled header and the loading fallback).
import { createFileRoute } from '@tanstack/react-router'
import AppLayout from '../components/layout/app-layout'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})
