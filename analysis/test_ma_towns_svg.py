from ma_towns_svg import simplify


def test_simplify_keeps_corners_and_drops_near_collinear_points():
    square = [(0, 0), (5, 0.1), (10, 0), (10, 10), (0, 10), (0, 0)]
    out = simplify(square, 0.5)
    assert (5, 0.1) not in out
    assert out[0] == (0, 0) and (10, 0) in out and (10, 10) in out and (0, 10) in out


def test_simplify_keeps_a_point_farther_than_the_tolerance():
    assert (5, 3) in simplify([(0, 0), (5, 3), (10, 0)], 0.5)
