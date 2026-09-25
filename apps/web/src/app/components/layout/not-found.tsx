import { useIntlayer } from 'react-intlayer'
import { ErrorPage, ProjectListSentence } from '../common/error-page'

/** The route 404, drawn like designs/pages/not-found.html without the breadcrumb. */
export default function NotFound() {
  const content = useIntlayer('not-found')
  return (
    <div className="mx-auto max-w-[1600px] px-8 pt-4 pb-6">
      <ErrorPage
        code="404"
        title={content.title}
        description={
          <ProjectListSentence before={content.before} link={content.link} after={content.after} />
        }
      />
    </div>
  )
}
