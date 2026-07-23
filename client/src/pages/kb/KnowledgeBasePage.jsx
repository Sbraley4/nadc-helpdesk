import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  BookOpen,
  FolderPlus,
  FilePlus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  Search,
  ArrowLeft,
  Save,
  X,
} from 'lucide-react';
import { kb } from '../../api';
import { Button, Badge, CenteredSpinner, EmptyState } from '../../components/shared';
import FormattedText from '../../components/shared/FormattedText';
import toast from 'react-hot-toast';

export default function KnowledgeBasePage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState('categories'); // 'categories' | 'category' | 'article' | 'edit-article'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch categories
  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['kb-categories'],
    queryFn: () => kb.getCategories(),
  });

  // Fetch category with articles
  const { data: categoryData } = useQuery({
    queryKey: ['kb-category', selectedCategory?.slug],
    queryFn: () => kb.getCategory(selectedCategory.slug),
    enabled: !!selectedCategory?.slug && view === 'category',
  });

  // Fetch single article
  const { data: articleData } = useQuery({
    queryKey: ['kb-article', selectedArticle?.slug],
    queryFn: () => kb.getArticle(selectedArticle.slug),
    enabled: !!selectedArticle?.slug && (view === 'article' || view === 'edit-article'),
  });

  // Search articles
  const { data: searchResults } = useQuery({
    queryKey: ['kb-search', searchQuery],
    queryFn: () => kb.searchArticles(searchQuery, 20),
    enabled: searchQuery.length >= 2,
  });

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: kb.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries(['kb-categories']);
      toast.success('Category created');
      setShowCategoryModal(false);
      setEditingCategory(null);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create category'),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }) => kb.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['kb-categories']);
      toast.success('Category updated');
      setShowCategoryModal(false);
      setEditingCategory(null);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update category'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: kb.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries(['kb-categories']);
      toast.success('Category deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete category'),
  });

  const deleteArticleMutation = useMutation({
    mutationFn: kb.deleteArticle,
    onSuccess: () => {
      queryClient.invalidateQueries(['kb-categories']);
      queryClient.invalidateQueries(['kb-category', selectedCategory?.slug]);
      toast.success('Article deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete article'),
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }) => kb.updateArticle(id, { isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries(['kb-categories']);
      queryClient.invalidateQueries(['kb-category', selectedCategory?.slug]);
      queryClient.invalidateQueries(['kb-article']);
      toast.success('Article updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update article'),
  });

  // Render category list
  const renderCategories = () => {
    if (loadingCategories) return <CenteredSpinner />;

    const categories = categoriesData?.categories || [];

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <Button onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}>
            <FolderPlus size={16} className="mr-2" />
            New Category
          </Button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>
          {searchQuery.length >= 2 && searchResults?.results && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {searchResults.results.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No articles found</p>
              ) : (
                searchResults.results.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => {
                      setSelectedArticle(article);
                      setView('article');
                      setSearchQuery('');
                    }}
                    className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <p className="font-medium text-gray-900">{article.title}</p>
                    <p className="text-xs text-gray-500">{article.category?.name}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {categories.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No categories yet"
            description="Create your first knowledge base category"
            action={
              <Button onClick={() => setShowCategoryModal(true)}>
                <FolderPlus size={16} className="mr-2" />
                Create Category
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <button
                    onClick={() => {
                      setSelectedCategory(category);
                      setView('category');
                    }}
                    className="text-lg font-semibold text-gray-900 hover:text-primary"
                  >
                    {category.name}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingCategory(category); setShowCategoryModal(true); }}
                      className="p-1 text-gray-400 hover:text-primary"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (category.articleCount > 0) {
                          toast.error('Cannot delete category with articles');
                          return;
                        }
                        if (confirm('Delete this category?')) {
                          deleteCategoryMutation.mutate(category.id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {category.description && (
                  <FormattedText text={category.description} as="p" className="text-sm text-gray-500 mb-3" />
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{category.articleCount || 0} articles</span>
                  <button
                    onClick={() => {
                      setSelectedCategory(category);
                      setView('category');
                    }}
                    className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
                  >
                    View <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render category detail with articles
  const renderCategoryDetail = () => {
    const category = categoryData || selectedCategory;
    const articles = categoryData?.articles || [];

    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => { setView('categories'); setSelectedCategory(null); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{category?.name}</h1>
            {category?.description && (
              <FormattedText text={category.description} as="p" className="text-sm text-gray-500" />
            )}
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <Button
            onClick={() => {
              setSelectedArticle({ categoryId: category.id, isNew: true });
              setView('edit-article');
            }}
          >
            <FilePlus size={16} className="mr-2" />
            New Article
          </Button>
        </div>

        {articles.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No articles yet"
            description="Create your first article in this category"
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Title</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Author</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Updated</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelectedArticle(article); setView('article'); }}
                        className="text-sm font-medium text-gray-900 hover:text-primary"
                      >
                        {article.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{article.authorName}</td>
                    <td className="px-4 py-3">
                      <Badge variant={article.isPublished ? 'success' : 'warning'} size="sm">
                        {article.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(article.updatedAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => togglePublishMutation.mutate({ id: article.id, isPublished: !article.isPublished })}
                          className="p-1 text-gray-400 hover:text-primary"
                          title={article.isPublished ? 'Unpublish' : 'Publish'}
                        >
                          {article.isPublished ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          onClick={() => { setSelectedArticle(article); setView('edit-article'); }}
                          className="p-1 text-gray-400 hover:text-primary"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this article?')) {
                              deleteArticleMutation.mutate(article.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Render article view
  const renderArticle = () => {
    const article = articleData;

    if (!article) return <CenteredSpinner />;

    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => {
              if (selectedCategory) {
                setView('category');
              } else {
                setView('categories');
              }
              setSelectedArticle(null);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
              <Badge variant={article.isPublished ? 'success' : 'warning'} size="sm">
                {article.isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              By {article.authorName} in {article.category?.name} | Updated {format(new Date(article.updatedAt), 'MMM d, yyyy')}
            </p>
          </div>
          <Button onClick={() => setView('edit-article')}>
            <Edit2 size={16} className="mr-2" />
            Edit
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FormattedText text={article.body} className="prose max-w-none" />
        </div>
      </div>
    );
  };

  // Render article editor
  const renderArticleEditor = () => {
    return (
      <ArticleEditor
        article={selectedArticle?.isNew ? null : articleData}
        categoryId={selectedArticle?.categoryId || articleData?.category?.id || selectedCategory?.id}
        onSave={() => {
          queryClient.invalidateQueries(['kb-categories']);
          queryClient.invalidateQueries(['kb-category']);
          if (selectedCategory) {
            setView('category');
          } else {
            setView('categories');
          }
          setSelectedArticle(null);
        }}
        onCancel={() => {
          if (selectedArticle?.isNew) {
            setView('category');
          } else if (articleData) {
            setView('article');
          } else {
            setView('categories');
          }
        }}
      />
    );
  };

  // Category modal
  const renderCategoryModal = () => {
    if (!showCategoryModal) return null;

    return (
      <CategoryModal
        category={editingCategory}
        onSave={(data) => {
          if (editingCategory) {
            updateCategoryMutation.mutate({ id: editingCategory.id, data });
          } else {
            createCategoryMutation.mutate(data);
          }
        }}
        onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
        isLoading={createCategoryMutation.isLoading || updateCategoryMutation.isLoading}
      />
    );
  };

  return (
    <div>
      {view === 'categories' && renderCategories()}
      {view === 'category' && renderCategoryDetail()}
      {view === 'article' && renderArticle()}
      {view === 'edit-article' && renderArticleEditor()}
      {renderCategoryModal()}
    </div>
  );
}

// Category Modal Component
function CategoryModal({ category, onSave, onClose, isLoading }) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [order, setOrder] = useState(category?.order || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    onSave({ name, description, order });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{category ? 'Edit Category' : 'New Category'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Article Editor Component
function ArticleEditor({ article, categoryId, onSave, onCancel }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(article?.title || '');
  const [body, setBody] = useState(article?.body || '');
  const [isPublished, setIsPublished] = useState(article?.isPublished || false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || article?.category?.id || '');

  const { data: categoriesData } = useQuery({
    queryKey: ['kb-categories'],
    queryFn: () => kb.getCategories(),
  });

  const createMutation = useMutation({
    mutationFn: kb.createArticle,
    onSuccess: () => {
      toast.success('Article created');
      onSave();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create article'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => kb.updateArticle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['kb-article', article?.slug]);
      toast.success('Article saved');
      onSave();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save article'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!body.trim()) {
      toast.error('Content is required');
      return;
    }
    if (!selectedCategoryId) {
      toast.error('Category is required');
      return;
    }

    const data = { title, body, categoryId: selectedCategoryId, isPublished };

    if (article?.id) {
      updateMutation.mutate({ id: article.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {article?.id ? 'Edit Article' : 'New Article'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                required
              >
                <option value="">Select category...</option>
                {categoriesData?.categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary font-mono text-sm"
              placeholder="Write your article content here..."
              required
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Publish article</span>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>
                <Save size={16} className="mr-2" />
                {isLoading ? 'Saving...' : 'Save Article'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
