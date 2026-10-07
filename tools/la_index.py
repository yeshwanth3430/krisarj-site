"""Rebuild the topic + lesson list on public/linear-algebra/index.html.

Usage: python3 tools/la_index.py
Edit TOPICS (topic page once live) and LIVE (lecture number -> lesson page) when a lesson goes live.
"""
import html, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "public", "linear-algebra", "index.html")

TOPICS = [  # (name, topic page or None, lecture numbers)
    ("Vectors &amp; linear equations", "topic-01.html", [1]),
    ("Elimination, A = LU &amp; permutations", "topic-02.html", [2, 4]),
    ("Inverses &amp; transposes", "topic-03.html", [3, 5]),
    ("Vector spaces, column space &amp; nullspace", None, [6, 7, 8]),
    ("Independence, rank &amp; the four subspaces", None, [9, 10]),
    ("Graphs &amp; networks", None, [11, 12]),
    ("Orthogonality &amp; projections", None, [13, 14]),
    ("Least squares &amp; Gram–Schmidt", None, [15, 16]),
    ("Determinants &amp; Cramer's rule", None, [17, 18, 19]),
    ("Eigenvalues, diagonalization &amp; powers", None, [20, 21]),
    ("ODEs, Markov chains &amp; Fourier", None, [22, 23]),
    ("Positive definite matrices &amp; minima", None, [24, 26]),
    ("Complex matrices, FFT &amp; Jordan form", None, [25, 27]),
    ("SVD &amp; linear transformations", None, [28, 29]),
    ("Change of basis &amp; pseudoinverse", None, [30, 31]),
]
LECTURES = """The Geometry of Linear Equations
Elimination with Matrices
Multiplication and Inverse Matrices
Factorization into A = LU
Transposes, Permutations, Vector Spaces
Column Space and Nullspace
Solving Ax = 0: Pivot Variables, Special Solutions
Solving Ax = b: Row Reduced Form R
Independence, Basis and Dimension
The Four Fundamental Subspaces
Matrix Spaces; Rank 1; Small World Graphs
Graphs, Networks, Incidence Matrices
Orthogonal Vectors and Subspaces
Projections onto Subspaces
Projection Matrices and Least Squares
Orthogonal Matrices and Gram-Schmidt
Properties of Determinants
Determinant Formulas and Cofactors
Cramer's Rule, Inverse Matrix and Volume
Eigenvalues and Eigenvectors
Diagonalization and Powers of A
Differential Equations and exp(At)
Markov Matrices; Fourier Series
Symmetric Matrices and Positive Definiteness
Complex Matrices; Fast Fourier Transform (FFT)
Positive Definite Matrices and Minima
Similar Matrices and Jordan Form
Singular Value Decomposition
Linear Transformations and their Matrices
Change of Basis; Image Compression
Left and Right Inverses; Pseudoinverse""".split("\n")
LIVE = {
    1: "01_geometry-of-linear-equations.html",
    2: "02_elimination-with-matrices.html",
    3: "03_multiplication-and-inverse-matrices.html",
    4: "04_factorization-into-a-lu.html",
    5: "05_transposes-permutations-vector-spaces.html",
}

assert len(LECTURES) == 31 and sorted(sum((t[2] for t in TOPICS), [])) == list(range(1, 32))
rows = []
for i, (name, url, lectures) in enumerate(TOPICS, 1):
    title = f'<a href="{url}">{name}</a>' if url else name
    items = []
    for n in lectures:
        t = html.escape(LECTURES[n - 1], quote=False)
        items.append(f'<li><span class="ln">L{n}</span><a href="{LIVE[n]}">{t}</a></li>' if n in LIVE
                     else f'<li class="todo"><span class="ln">L{n}</span>{t}</li>')
    cls = "" if url else ' class="todo"'
    rows.append(f'    <li{cls}><span class="n">{i:02d}</span><span class="t">{title}\n'
                f'      <ol class="lessons">{"".join(items)}</ol></span><span class="s">{"Live" if url else "Coming soon"}</span></li>')
s = open(PAGE).read()
s, k = re.subn(r'<ol class="toc">.*?\n  </ol>', lambda m: '<ol class="toc">\n' + "\n".join(rows) + '\n  </ol>', s, flags=re.S)
assert k == 1
open(PAGE, "w").write(s)
print("index rebuilt:", len(LIVE), "lessons live")
