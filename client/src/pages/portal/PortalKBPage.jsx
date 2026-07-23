import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Search, BookOpen, ChevronRight, ArrowLeft } from 'lucide-react';
import { portalKB } from '../../api/portal';
import FormattedText from '../../components/shared/FormattedText';

export default function PortalKBPage() {
  const { categorySlug, articleSlug } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // If we have an article slug, show article view
  if (articleSlug) {
    return <ArticleView slug={articleSlug} />;
  }

  // If we have a category slug, show category view
  if (categorySlug) {
    return <CategoryView slug={categorySlug} />;
  }

  // Otherwise show the main KB page with categories
  return <KBHome searchQuery={searchQuery} setSearchQuery={setSearchQuery} />;
}

function KBHome({ searchQuery, setSearchQuery }) {
  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ['portal-kb-categories'],
    queryFn: portalKB.getCategories,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['portal-kb-search', searchQuery],
    queryFn: () => portalKB.searchArticles(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const categories = categoriesData?.categories || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Knowledge Base</h1>
      <p className="text-gray-600 mb-6">Find answers to common questions and learn how to use our services</p>

      {/* Search */}
      <div className="relative mb-8">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-[#1B2A4A] focus:border-[#1B2A4A] text-lg"
        />
      </div>

      {/* Search results */}
      {searchQuery.length >= 2 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Results</h2>
          {searchResults?.results?.length === 0 ? (
            <p className="text-gray-500">No articles found for "{searchQuery}"</p>
          ) : (
            <div className="space-y-3">
              {searchResults?.results?.map((article) => (
                <Link
                  key={article.id}
                  to={`/portal/kb/${article.category?.slug}/${article.slug}`}
                  className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-[#1B2A4A]/30 transition-colors"
                >
                  <h3 className="font-medium text-gray-900">{article.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{article.category?.name}</p>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{article.excerpt}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      {!searchQuery && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Browse by Category</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B2A4A]" />
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No articles yet</h3>
              <p className="text-gray-500">Knowledge base articles will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/portal/kb/${category.slug}`}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:border-[#1B2A4A]/30 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-[#1B2A4A]">
                        {category.name}
                      </h3>
                      {category.description && (
                        <FormattedText text={category.description} as="p" className="text-sm text-gray-500 mt-1" />
                      )}
                      <p className="text-sm text-gray-400 mt-2">
                        {category.articleCount} {category.articleCount === 1 ? 'article' : 'articles'}
                      </p>
                    </div>
                    <ChevronRight size={20} className="text-gray-400 group-hover:text-[#1B2A4A]" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CategoryView({ slug }) {
  const { data: category, isLoading } = useQuery({
    queryKey: ['portal-kb-category', slug],
    queryFn: () => portalKB.getCategory(slug),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B2A4A]" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Category not found</h3>
        <Link to="/portal/kb" className="text-[#1B2A4A] hover:underline">
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/portal/kb" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} />
        Back to Knowledge Base
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{category.name}</h1>
      {category.description && <FormattedText text={category.description} as="p" className="text-gray-600 mb-6" />}

      {category.articles?.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No articles in this category</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {category.articles?.map((article) => (
            <Link
              key={article.id}
              to={`/portal/kb/${slug}/${article.slug}`}
              className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-[#1B2A4A]/30 transition-colors"
            >
              <h3 className="font-medium text-gray-900">{article.title}</h3>
              <p className="text-sm text-gray-500 mt-1">
                By {article.authorName} | Updated {new Date(article.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleView({ slug }) {
  const { categorySlug } = useParams();

  const { data: article, isLoading } = useQuery({
    queryKey: ['portal-kb-article', slug],
    queryFn: () => portalKB.getArticle(slug),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B2A4A]" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Article not found</h3>
        <Link to="/portal/kb" className="text-[#1B2A4A] hover:underline">
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/portal/kb" className="hover:text-gray-700">Knowledge Base</Link>
        <ChevronRight size={16} />
        <Link to={`/portal/kb/${article.category?.slug}`} className="hover:text-gray-700">
          {article.category?.name}
        </Link>
        <ChevronRight size={16} />
        <span className="text-gray-900">{article.title}</span>
      </nav>

      <article className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{article.title}</h1>
        <p className="text-sm text-gray-500 mb-6">
          By {article.authorName} | Updated {new Date(article.updatedAt).toLocaleDateString()}
        </p>
        <FormattedText text={article.body} className="prose max-w-none text-gray-700" />
      </article>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          Didn't find what you were looking for?{' '}
          <Link to="/portal/tickets/new" className="font-medium underline">
            Submit a support ticket
          </Link>
        </p>
      </div>
    </div>
  );
}
